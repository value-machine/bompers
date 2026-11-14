import { describe, expect, it } from "vitest";
import type { CombatEvent } from "@/features/combat/api/combatApi";
import { readSoundCues, type SoundSnapshot } from "@/features/sound/services/soundCues";
import type { SoundPlayerSnapshot } from "@/features/sound/types/sound.types";

const player = (slot: number, patch: Partial<SoundPlayerSnapshot> = {}): SoundPlayerSnapshot => ({
  slot,
  jumpCount: 0,
  wallJumpCount: 0,
  landCount: 0,
  lastLandingSpeed: 0,
  tumbleBounceCount: 0,
  inPlay: true,
  divePhase: "idle",
  diveBonked: false,
  ...patch,
});

const snapshot = (patch: Partial<SoundSnapshot> = {}): SoundSnapshot => ({
  players: [player(0), player(1)],
  events: [],
  roundPhase: "playing",
  ...patch,
});

let seq = 0;
const event = (body: Record<string, unknown>): CombatEvent =>
  ({ ...body, seq: (seq += 1), timeSeconds: 0 }) as unknown as CombatEvent;

const idsOf = (cues: readonly { soundId: string }[]): string[] => cues.map((cue) => cue.soundId);

/** Reads a first frame, then `next`, and returns the second frame's cues. */
const cuesAfter = (next: SoundSnapshot, first: SoundSnapshot = snapshot()) => {
  const start = readSoundCues(null, first);
  return readSoundCues(start.cursor, next).cues;
};

describe("readSoundCues", () => {
  it("should cue only the round start when a round's first frame is read", () => {
    const { cues } = readSoundCues(null, snapshot());
    expect(cues).toEqual([{ soundId: "round-start", slot: null, gain: 1 }]);
  });

  it("should cue a pitched jump when a player's jump or wall-jump counter rises", () => {
    const cues = cuesAfter(snapshot({ players: [player(0), player(1, { wallJumpCount: 1 })] }));
    expect(cues).toEqual([{ soundId: "jump", slot: 1, gain: 1 }]);
  });

  it("should scale the land gain with landing speed when a player lands", () => {
    const soft = cuesAfter(
      snapshot({ players: [player(0, { landCount: 1, lastLandingSpeed: 0 }), player(1)] })
    );
    const hard = cuesAfter(
      snapshot({ players: [player(0, { landCount: 1, lastLandingSpeed: 5000 }), player(1)] })
    );
    expect(soft[0]?.soundId).toBe("land");
    expect(soft[0]?.gain).toBeLessThan(1);
    expect(hard[0]?.gain).toBe(1);
  });

  it("should cue a tumble bounce when the tumble bounce counter rises", () => {
    const cues = cuesAfter(snapshot({ players: [player(0, { tumbleBounceCount: 2 }), player(1)] }));
    expect(idsOf(cues)).toEqual(["tumble-bounce"]);
  });

  it("should cue a dive launch when a dive enters travel", () => {
    const cues = cuesAfter(snapshot({ players: [player(0, { divePhase: "travel" }), player(1)] }));
    expect(cues).toEqual([{ soundId: "dive-launch", slot: 0, gain: 1 }]);
  });

  it("should cue a dive impact when a dive ends in a terrain bonk", () => {
    const first = snapshot({ players: [player(0, { divePhase: "travel" }), player(1)] });
    const next = snapshot({
      players: [player(0, { divePhase: "recovery", diveBonked: true }), player(1)],
    });
    expect(idsOf(cuesAfter(next, first))).toEqual(["dive-impact"]);
  });

  it("should cue a respawn when a player comes back into play", () => {
    const first = snapshot({ players: [player(0, { inPlay: false }), player(1)] });
    expect(idsOf(cuesAfter(snapshot(), first))).toEqual(["respawn"]);
  });

  it("should map combat events to their sounds when new events arrive", () => {
    const events = [
      event({ type: "rocketFired", slot: 1 }),
      event({ type: "explosion", byPlayerSlot: 1 }),
      event({ type: "playerHit", victimSlot: 0, byPlayerSlot: 1, source: "rocket" }),
      event({ type: "playerHit", victimSlot: 1, byPlayerSlot: 0, source: "dive" }),
      event({ type: "playerEliminated", victimSlot: 0 }),
      event({ type: "pickupCollected", slot: 1 }),
      event({ type: "pickupSpawned" }),
      event({ type: "terrainDestroyed", soundId: "crumble" }),
    ];
    const cues = cuesAfter(snapshot({ events }));
    expect(cues.map((cue) => [cue.soundId, cue.slot])).toEqual([
      ["rocket-fire", 1],
      ["explosion", null],
      ["hit", 0],
      ["dive-impact", 1],
      ["elimination", 0],
      ["pickup", 1],
      ["crumble", null],
    ]);
  });

  it("should not replay events when they were already read", () => {
    const events = [event({ type: "rocketFired", slot: 0 })];
    const start = readSoundCues(null, snapshot());
    const once = readSoundCues(start.cursor, snapshot({ events }));
    const twice = readSoundCues(once.cursor, snapshot({ events }));
    expect(idsOf(once.cues)).toEqual(["rocket-fire"]);
    expect(twice.cues).toEqual([]);
  });

  it("should cue the round end once when the round phase turns to ended", () => {
    const start = readSoundCues(null, snapshot());
    const ended = readSoundCues(start.cursor, snapshot({ roundPhase: "ended" }));
    const after = readSoundCues(ended.cursor, snapshot({ roundPhase: "ended" }));
    expect(idsOf(ended.cues)).toEqual(["round-end"]);
    expect(after.cues).toEqual([]);
  });
});
