import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import { createCameraShake } from "@/features/camera/api/cameraApi";
import type { CombatEvent } from "@/features/combat/api/combatApi";
import {
  createFeelState,
  hitFlashAmount,
  readFeelCues,
  type FeelBody,
} from "@/features/effects/services/feelCues";

const FEEL = DEFAULT_GAME_TUNABLES.feel;
const FLASH = FEEL.hitFlash;

const hit = (seq: number, zone: "front" | "back", x = 90): CombatEvent => ({
  type: "playerHit",
  seq,
  timeSeconds: 0,
  victimSlot: 1,
  byPlayerSlot: 0,
  source: "dive",
  kind: "contact",
  zone,
  damage: zone === "back" ? 2 : 1,
  healthLeft: 3,
  x,
  y: 100,
});

const blast = (seq: number, radius = 64): CombatEvent => ({
  type: "explosion",
  seq,
  timeSeconds: 0,
  byPlayerSlot: 0,
  x: 0,
  y: 0,
  radius,
});

const body = (over: Partial<FeelBody> = {}): FeelBody => ({
  id: "p2",
  slot: 1,
  x: 100,
  rollBounceCount: 0,
  lastRollBounceSpeed: 0,
  ...over,
});

function frame(over: { events?: CombatEvent[]; bodies?: FeelBody[]; nowMs?: number } = {}) {
  return {
    events: over.events ?? [],
    bodies: over.bodies ?? [body()],
    nowMs: over.nowMs ?? 1000,
    feel: FEEL,
    fullBlastRadius: 64,
    reducedMotion: false,
    shake: createCameraShake(),
  };
}

const liveKicks = (f: ReturnType<typeof frame>) => f.shake.kicks.filter((k) => k.px > 0);

describe("hitFlashAmount", () => {
  it("should hold the peak and then fade to 0 when time passes", () => {
    const hard = { hard: true, reducedMotion: false };
    expect(hitFlashAmount(0, hard, FLASH)).toBe(FLASH.back);
    expect(hitFlashAmount(FLASH.holdSeconds * 1000 - 1, hard, FLASH)).toBe(FLASH.back);
    const mid = FLASH.holdSeconds * 1000 + (FLASH.fadeSeconds * 1000) / 2;
    expect(hitFlashAmount(mid, hard, FLASH)).toBeCloseTo(FLASH.back / 2);
    expect(hitFlashAmount((FLASH.holdSeconds + FLASH.fadeSeconds) * 1000, hard, FLASH)).toBe(0);
  });

  it("should flash a back hit stronger than a front hit", () => {
    const front = hitFlashAmount(0, { hard: false, reducedMotion: false }, FLASH);
    const back = hitFlashAmount(0, { hard: true, reducedMotion: false }, FLASH);
    expect(back).toBeGreaterThan(front);
  });

  it("should flash gentler when the OS asks for reduced motion", () => {
    const reduced = hitFlashAmount(0, { hard: true, reducedMotion: true }, FLASH);
    expect(reduced).toBeCloseTo(FLASH.back * FLASH.reducedMotionScale);
  });
});

describe("readFeelCues", () => {
  it("should flash the victim and shake once when a hit arrives", () => {
    const state = createFeelState();
    const f = frame({ events: [hit(1, "front")] });
    readFeelCues(state, f);
    expect(state.hits.get("p2")).toMatchObject({ dirX: 1, hard: false, flash: FLASH.front });
    expect(liveKicks(f).map((k) => k.px)).toEqual([FEEL.shake.hit.px]);
    readFeelCues(state, f);
    expect(liveKicks(f)).toHaveLength(1);
  });

  it("should shake harder and start a hit-stop when the hit lands on the back", () => {
    const state = createFeelState();
    const f = frame({ events: [hit(1, "back")] });
    readFeelCues(state, f);
    expect(liveKicks(f)[0]!.px).toBe(FEEL.shake.hit.px * FEEL.shake.hardHitScale);
    expect(state.hitStopUntilMs).toBe(1000 + FEEL.hitStop.seconds * 1000);
  });

  it("should not hit-stop when a front hit lands", () => {
    const state = createFeelState();
    readFeelCues(state, frame({ events: [hit(1, "front")] }));
    expect(state.hitStopUntilMs).toBe(0);
  });

  it("should neither flash nor shake the victim when a hit takes no chunk", () => {
    const state = createFeelState();
    const blocked = { ...hit(1, "back"), damage: 0 } as CombatEvent;
    const f = frame({ events: [blocked] });
    readFeelCues(state, f);
    expect(state.hits.size).toBe(0);
    expect(liveKicks(f)).toEqual([]);
    expect(state.hitStopUntilMs).toBe(0);
  });

  it("should remember the chunks taken when a hit lands", () => {
    const state = createFeelState();
    readFeelCues(state, frame({ events: [hit(1, "back")] }));
    expect(state.hits.get("p2")?.damage).toBe(2);
  });

  it("should scale explosion shake by blast radius when a blast goes off", () => {
    const state = createFeelState();
    const f = frame({ events: [blast(1, 32)] });
    readFeelCues(state, f);
    expect(liveKicks(f)[0]!.px).toBeCloseTo(FEEL.shake.explosion.px / 2);
  });

  it("should shake on a roll bounce but not on the first sight of a player", () => {
    const state = createFeelState();
    const f = frame({ bodies: [body({ rollBounceCount: 4 })] });
    readFeelCues(state, f);
    expect(liveKicks(f)).toHaveLength(0);
    f.bodies = [body({ rollBounceCount: 5, lastRollBounceSpeed: 450 })];
    readFeelCues(state, f);
    expect(liveKicks(f)[0]!.px).toBeCloseTo(FEEL.shake.rollBounce.px / 2);
  });

  it("should end the flash when its time is up", () => {
    const state = createFeelState();
    readFeelCues(state, frame({ events: [hit(1, "back")] }));
    readFeelCues(state, frame({ nowMs: 2000 }));
    expect(state.hits.get("p2")!.flash).toBe(0);
  });
});
