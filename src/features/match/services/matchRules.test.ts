import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import { mapPlayerInputs } from "@/shared/utils/gameInputMapping";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { applyHit, type CombatEvent } from "@/features/combat/api/combatApi";
import { createGameState, playersInPlay, stepGame } from "@/features/match/services/gameSim";
import {
  isRestartPress,
  roundResultLabel,
  roundWinners,
  scoreEvent,
} from "@/features/match/services/matchRules";

const tunables = DEFAULT_GAME_TUNABLES;
const scoring = tunables.match.scoring;
const { respawnDelaySeconds, spawnProtectionSeconds } = tunables.match;
const dt = 1 / 120;

const level: LevelDefinition = {
  formatVersion: 1,
  meta: { levelId: "t", title: "T" },
  settings: { cellSize: 8, gravity: 1 },
  worldSize: { w: 800, h: 400 },
  terrain: [
    { shape: { type: "rect", x: 0, y: 320, w: 800, h: 32 }, role: "platform", materialId: "stone" },
  ],
  spawns: [
    { x: 100, y: 320 },
    { x: 400, y: 320 },
    { x: 700, y: 320 },
  ],
  drops: [],
  collectibles: [{ at: { x: 250, y: 300 }, itemId: "point-orb" }],
  bounds: { x: -100, y: -100, w: 1000, h: 600 },
};

const keys = (...codes: string[]) => mapPlayerInputs({ heldKeys: new Set(codes), gamepads: [] });
type Game = ReturnType<typeof createGameState>;
const stepFor = (state: Game, seconds: number, inputs = keys()): Game => {
  for (let t = 0; t < seconds; t += dt) stepGame(state, inputs, dt);
  return state;
};
const newGame = (matchDurationS?: number): Game =>
  stepGame(
    createGameState({
      level: { ...level, settings: { ...level.settings, matchDurationS } },
      tunables,
    }),
    keys(),
    dt
  );

/** A contact hit from `attacker` on `victim` (both slots), through the shared hit API. */
function hit(state: Game, victimSlot: number, attackerSlot: number | null): void {
  applyHit(
    { ...state, players: playersInPlay(state) },
    {
      victimSlot,
      attackerSlot,
      kind: "contact",
      source: "dive",
      contactPoint: { x: 0, y: 0 },
      direction: { x: 0, y: 1 },
    }
  );
}

const eliminated = (victimSlot: number, byPlayerSlot: number | null): CombatEvent => ({
  type: "playerEliminated",
  victimSlot,
  byPlayerSlot,
  cause: "out-of-bounds",
  seq: 1,
  timeSeconds: 0,
});

describe("scoreEvent", () => {
  it("should give the kill points to the credited player when another player eliminates the victim", () => {
    const scores = [0, 0];
    scoreEvent(scores, eliminated(1, 0), scoring);
    expect(scores).toEqual([scoring.kill, 0]);
  });

  it("should take the fall penalty from the victim when nobody gets the credit", () => {
    const scores = [0, 0];
    scoreEvent(scores, eliminated(1, null), scoring);
    expect(scores).toEqual([0, -scoring.fallPenalty]);
  });

  it("should leave scores unchanged when the event is not an elimination", () => {
    const scores = [0];
    scoreEvent(
      scores,
      { type: "pickupCollected", itemId: "x", slot: 0, seq: 1, timeSeconds: 0 },
      scoring
    );
    expect(scores).toEqual([0]);
  });
});

describe("match rules in the sim", () => {
  it("should score a hit kill exactly once when the victim's last chunk is lost", () => {
    const state = newGame();
    state.combat.fighters.get("p1")!.health = 1;
    hit(state, 1, 0);
    stepFor(state, 0.5);
    expect(state.rules.scores.slice(0, 2)).toEqual([scoring.kill, 0]);
  });

  it("should credit the last hitter when a player falls out within the credit window", () => {
    const state = newGame();
    hit(state, 1, 0);
    stepFor(state, tunables.combat.killCreditSeconds - 1);
    state.players[1]!.y = 2000;
    stepFor(state, 0.1);
    expect(state.rules.scores.slice(0, 2)).toEqual([scoring.kill, 0]);
  });

  it("should take the fall penalty when a player falls out after the credit window", () => {
    const state = newGame();
    hit(state, 1, 0);
    stepFor(state, tunables.combat.killCreditSeconds + 0.5);
    state.players[1]!.y = 2000;
    stepFor(state, 0.1);
    expect(state.rules.scores.slice(0, 2)).toEqual([0, -scoring.fallPenalty]);
  });

  it("should keep a player in play when they are far beyond the side or top edge of the bounds", () => {
    const state = newGame();
    const [left, right] = state.players;
    left!.x = -5000;
    right!.y = -5000;
    stepFor(state, 0.05);
    expect(playersInPlay(state).map((p) => p.slot)).toEqual([0, 1]);
    expect(state.combat.events.filter((e) => e.type === "playerEliminated")).toEqual([]);
  });

  it("should eliminate a player who falls below the bounds bottom beside the arena", () => {
    const state = newGame();
    state.players[0]!.x = -5000;
    state.players[0]!.y = 2000;
    stepFor(state, 0.05);
    expect(playersInPlay(state).map((p) => p.slot)).toEqual([1]);
  });

  it("should keep a player out of play when the respawn delay has not passed", () => {
    const state = newGame();
    const victim = state.players[1]!;
    victim.y = 2000;
    stepGame(state, keys(), dt);
    const parkedY = victim.y;
    stepFor(state, respawnDelaySeconds - 0.1);
    expect(playersInPlay(state).map((p) => p.slot)).toEqual([0]);
    expect(victim.y).toBe(parkedY);
    stepFor(state, 0.15);
    expect(playersInPlay(state).map((p) => p.slot)).toEqual([0, 1]);
  });

  it("should respawn at the spawn farthest from the opponents when the delay passes", () => {
    const state = newGame();
    state.players[0]!.x = 650;
    state.players[1]!.y = 2000;
    stepFor(state, respawnDelaySeconds + 0.05);
    expect(state.players[1]!.x).toBe(100);
  });

  it("should block damage only when the hit lands inside the protection time", () => {
    const state = newGame();
    state.players[1]!.y = 2000;
    stepFor(state, respawnDelaySeconds + 0.05);
    const fighter = state.combat.fighters.get("p1")!;
    expect(fighter.invulnerableUntil).toBeGreaterThan(state.timeSeconds);
    hit(state, 1, 0);
    expect(fighter.health).toBe(tunables.combat.maxHealth);
    stepFor(state, spawnProtectionSeconds);
    hit(state, 1, 0);
    expect(fighter.health).toBe(tunables.combat.maxHealth - 1);
  });

  it("should let a player move freely when spawn protection is running", () => {
    const state = newGame();
    state.players[0]!.x = 650;
    state.players[0]!.y = 320;
    state.players[1]!.y = 2000;
    stepFor(state, respawnDelaySeconds + 0.05);
    const startX = state.players[1]!.x;
    stepFor(state, 0.5, keys("ArrowRight"));
    expect(state.combat.fighters.get("p1")!.invulnerableUntil).toBeGreaterThan(state.timeSeconds);
    expect(state.players[1]!.x).toBeGreaterThan(startX + 50);
  });

  it("should give orb points when a player touches an orb", () => {
    const state = newGame();
    state.players[0]!.x = 250;
    stepFor(state, tunables.collectibles.firstDelaySeconds + 1);
    expect(state.rules.scores[0]).toBe(scoring.orb);
  });

  it("should name the top scorer the winner when the timer runs out", () => {
    const state = newGame(1);
    state.rules.scores[1] = 3;
    stepFor(state, 1.1);
    expect(state.round).toMatchObject({ phase: "ended", winners: [1] });
  });
});

describe("respawn without spawns", () => {
  it("should respawn in the middle of the bounds when the level has no spawns", () => {
    const state = stepGame(
      createGameState({ level: { ...level, spawns: [] }, tunables }),
      keys(),
      dt
    );
    state.players[1]!.y = 2000;
    stepFor(state, respawnDelaySeconds + 0.05);
    expect(state.players[1]).toMatchObject({ x: 400, y: expect.any(Number) });
    expect(state.rules.scores[1]).toBe(-scoring.fallPenalty);
  });
});

describe("roundWinners", () => {
  it("should list every top scorer when scores tie", () => {
    expect(roundWinners([2, 1, 2, 0], [0, 1, 2, 3])).toEqual([0, 2]);
  });

  it("should ignore scores when their slot never joined", () => {
    expect(roundWinners([0, 0, 5], [0, 1])).toEqual([0, 1]);
  });

  it("should return no winner when nobody joined", () => {
    expect(roundWinners([0, 0], [])).toEqual([]);
  });
});

describe("isRestartPress", () => {
  const jumping = keys("KeyW");
  const idle = keys();

  it("should restart when jump is freshly pressed after the lock", () => {
    expect(
      isRestartPress({
        phase: "ended",
        secondsSinceEnd: 3,
        lockSeconds: 2,
        inputs: jumping,
        previous: idle,
      })
    ).toBe(true);
  });

  it("should not restart when locked, playing or jump is held", () => {
    const base = { phase: "ended" as const, secondsSinceEnd: 3, lockSeconds: 2, inputs: jumping };
    expect(isRestartPress({ ...base, secondsSinceEnd: 1, previous: idle })).toBe(false);
    expect(isRestartPress({ ...base, phase: "playing", previous: idle })).toBe(false);
    expect(isRestartPress({ ...base, previous: jumping })).toBe(false);
  });
});

describe("roundResultLabel", () => {
  it("should name the single winner, list a draw, or say time when nobody joined", () => {
    expect(roundResultLabel([1])).toBe("P2 wins!");
    expect(roundResultLabel([0, 2])).toBe("Draw: P1 & P3");
    expect(roundResultLabel([])).toBe("Time!");
  });
});
