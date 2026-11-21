import { describe, expect, it } from "vitest";
import type { CombatEvent } from "@/features/combat/api/combatApi";
import { JUICE_VOLUME } from "@/shared/config/gameJuice";
import {
  readSoundCues,
  readSoundLoops,
  CRATE_LAND_SOUND,
  WALL_BONK_SOUND,
  DASH_DENIED_SOUND,
  KART_ENGINE_SOUNDS,
  type SoundSnapshot,
} from "@/features/sound/services/soundCues";
import type { SoundPlayerSnapshot, SoundWorldSnapshot } from "@/features/sound/types/sound.types";
import { SOUND_FILES, SOUND_MIX } from "@/features/sound/services/soundBank";

const player = (slot: number, patch: Partial<SoundPlayerSnapshot> = {}): SoundPlayerSnapshot => ({
  slot,
  jumpCount: 0,
  wallJumpCount: 0,
  landCount: 0,
  lastLandingSpeed: 0,
  rollBounceCount: 0,
  moveRollCount: 0,
  rollRestCount: 0,
  crouchCount: 0,
  inPlay: true,
  divePhase: "idle",
  diveBonked: false,
  diveBonkSoundId: "none",
  speed: 0,
  terrainHitSpeed: 0,
  diveRefillCount: 0,
  diveDeniedCount: 0,
  orbCount: 0,
  catchFireCount: 0,
  iceDouseCount: 0,
  frozenCount: 0,
  iceCrackCount: 0,
  iceShatterCount: 0,
  ...patch,
});

const world = (patch: Partial<SoundWorldSnapshot> = {}): SoundWorldSnapshot => ({
  timeSeconds: 0,
  torchSlots: [],
  freezeSlots: [],
  burningSamples: 0,
  burningBlobs: 0,
  thawedSamples: 0,
  frozenVersion: 0,
  beamClashes: 0,
  objectMomentCount: 0,
  objectSounds: [],
  kartEngines: [],
  crateLandings: 0,
  ...patch,
});

const snapshot = (patch: Partial<SoundSnapshot> = {}): SoundSnapshot => ({
  players: [player(0), player(1)],
  events: [],
  roundPhase: "playing",
  world: world(),
  bursts: [],
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
    const softest = SOUND_MIX.landingMinSpeed;
    const soft = cuesAfter(
      snapshot({ players: [player(0, { landCount: 1, lastLandingSpeed: softest }), player(1)] })
    );
    const hard = cuesAfter(
      snapshot({ players: [player(0, { landCount: 1, lastLandingSpeed: 5000 }), player(1)] })
    );
    expect(soft[0]?.soundId).toBe("land");
    expect(soft[0]?.gain).toBeLessThan(1);
    expect(hard[0]?.gain).toBe(1);
  });

  it("should cue a roll bounce when the roll bounce counter rises", () => {
    const cues = cuesAfter(snapshot({ players: [player(0, { rollBounceCount: 2 }), player(1)] }));
    expect(idsOf(cues)).toEqual(["tumble-bounce"]);
  });

  it("should cue a soft thud when a dash roll starts or a roll comes to rest", () => {
    for (const patch of [{ moveRollCount: 1 }, { rollRestCount: 1 }]) {
      const cues = cuesAfter(snapshot({ players: [player(0, patch), player(1)] }));
      expect(cues).toEqual([{ soundId: "land", slot: 0, gain: SOUND_MIX.crouchGain }]);
    }
  });

  it("should cue a dive launch when a dive enters travel", () => {
    const cues = cuesAfter(snapshot({ players: [player(0, { divePhase: "travel" }), player(1)] }));
    expect(cues).toEqual([{ soundId: "dive-launch", slot: 0, gain: 1 }]);
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
      ["pickup", 1],
      ["crumble", null],
    ]);
  });

  it("should play the land splut, and no pop yet, when a moving part crushes a player", () => {
    const events = [event({ type: "playerEliminated", victimSlot: 2, cause: "crush" })];
    const cues = cuesAfter(snapshot({ events }));
    expect(cues.map((cue) => [cue.soundId, cue.slot])).toEqual([["land", 2]]);
  });

  it("should play the elimination pop on the frame the knocked-out blob bursts into goo", () => {
    const events = [event({ type: "playerEliminated", victimSlot: 1, cause: "dive" })];
    const hit = readSoundCues(readSoundCues(null, snapshot()).cursor, snapshot({ events }));
    expect(idsOf(hit.cues)).not.toContain("elimination");
    const burst = readSoundCues(hit.cursor, snapshot({ events, bursts: [{ n: 1, slot: 1 }] }));
    expect(burst.cues.map((cue) => [cue.soundId, cue.slot])).toEqual([["elimination", 1]]);
    const after = readSoundCues(burst.cursor, snapshot({ events, bursts: [{ n: 1, slot: 1 }] }));
    expect(after.cues).toEqual([]);
  });

  it("should play the elimination pop at once when a player falls out of the arena", () => {
    const events = [event({ type: "playerEliminated", victimSlot: 0, cause: "out-of-bounds" })];
    expect(cuesAfter(snapshot({ events })).map((cue) => [cue.soundId, cue.slot])).toEqual([
      ["elimination", 0],
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

describe("readSoundCues — crouch", () => {
  it("should play a soft land thud when a player starts a crouch", () => {
    const { cursor } = readSoundCues(null, snapshot());
    const frame = snapshot({ players: [player(0, { crouchCount: 1 }), player(1)] });
    const { cues } = readSoundCues(cursor, frame);
    expect(cues).toEqual([{ soundId: "land", slot: 0, gain: SOUND_MIX.crouchGain }]);
  });
});

describe("readSoundCues — wall bonks and hit intensity", () => {
  it("should cue the landing splut when a dive ends in a terrain bonk", () => {
    const first = snapshot({ players: [player(0, { divePhase: "travel" }), player(1)] });
    const next = snapshot({
      players: [player(0, { divePhase: "recovery", diveBonked: true }), player(1)],
    });
    expect(idsOf(cuesAfter(next, first))).toEqual([WALL_BONK_SOUND]);
    expect(WALL_BONK_SOUND).toBe("land");
  });

  it("should layer the wall's material sound over the bonk at the bonk's intensity when a dive bonks into terrain", () => {
    const first = snapshot({ players: [player(2, { divePhase: "travel" }), player(1)] });
    const bonk = (terrainHitSpeed: number) =>
      cuesAfter(
        snapshot({
          players: [
            player(2, {
              divePhase: "recovery",
              diveBonked: true,
              diveBonkSoundId: "thud",
              terrainHitSpeed,
            }),
            player(1),
          ],
        }),
        first
      );
    expect(bonk(SOUND_MIX.hitFullSpeed)).toEqual([
      { soundId: "land", slot: 2, gain: 1 },
      { soundId: "thud", slot: null, gain: 1 },
    ]);
    const soft = bonk(SOUND_MIX.hitFullSpeed / 4);
    expect(soft[0]?.gain).toBeLessThan(1);
    expect(soft[1]?.gain).toBe(soft[0]?.gain);
  });

  const hitCue = (speed: number, damage: number) =>
    cuesAfter(
      snapshot({
        players: [player(0, { speed }), player(1)],
        events: [
          event({ type: "playerHit", victimSlot: 0, byPlayerSlot: 1, source: "rocket", damage }),
        ],
      })
    )[0];

  it("should scale a hit's gain with the victim's knockback speed when a player is hit", () => {
    expect(hitCue(SOUND_MIX.hitFullSpeed, 1)?.gain).toBe(1);
    expect(hitCue(SOUND_MIX.hitFullSpeed * 0.9, 1)?.gain).toBeLessThan(1);
  });

  it("should never play a hurt below the hurt floor when the hit takes a chunk with no push", () => {
    expect(hitCue(0, 1)).toEqual({ soundId: "hit", slot: 0, gain: JUICE_VOLUME.hurtMinGain });
  });

  it("should only clink softly off the helmet when a hit takes no chunk", () => {
    expect(hitCue(SOUND_MIX.hitFullSpeed, 0)).toEqual({
      soundId: "clink",
      slot: 0,
      gain: SOUND_MIX.crouchGain,
    });
  });
});

describe("readSoundCues — headbutt reset", () => {
  it("should play the pickup sound pitched by the collector when a player takes a headbutt reset", () => {
    const frame = snapshot({ players: [player(0), player(1, { diveRefillCount: 1 })] });
    expect(cuesAfter(frame)).toEqual([{ soundId: "pickup", slot: 1, gain: 1 }]);
  });
});

describe("readSoundCues — denied dash", () => {
  it("should play the soft denied click pitched by the player when a dash press is denied", () => {
    const frame = snapshot({ players: [player(0, { diveDeniedCount: 1 }), player(1)] });
    expect(cuesAfter(frame)).toEqual([
      { soundId: DASH_DENIED_SOUND, slot: 0, gain: SOUND_MIX.crouchGain },
    ]);
  });
});

describe("readSoundCues — point orbs", () => {
  it("should play the orb chime pitched by the collector when a player takes a point orb", () => {
    const frame = snapshot({ players: [player(0), player(1, { orbCount: 1 })] });
    expect(cuesAfter(frame)).toEqual([{ soundId: "orb-collect", slot: 1, gain: 1 }]);
  });
});

describe("readSoundCues — weapon crates", () => {
  it("should play one soft unpitched thwap when crates land in a frame", () => {
    const frame = snapshot({ world: world({ crateLandings: 2 }) });
    expect(cuesAfter(frame)).toEqual([
      { soundId: CRATE_LAND_SOUND, slot: null, gain: SOUND_MIX.crouchGain },
    ]);
  });
});

describe("readSoundCues — physics objects", () => {
  it("should play each new object moment's sound unpitched when objects bounce or catch fire", () => {
    const frame = snapshot({
      world: world({
        objectMomentCount: 3,
        objectSounds: [
          { seq: 0, soundId: "tumble-bounce", gain: 0.5 },
          { seq: 1, soundId: "tumble-bounce", gain: 0.8 },
          { seq: 2, soundId: "catch-fire", gain: 1 },
        ],
      }),
    });
    const previous = readSoundCues(null, snapshot({ world: world({ objectMomentCount: 1 }) }));
    expect(readSoundCues(previous.cursor, frame).cues).toEqual([
      { soundId: "tumble-bounce", slot: null, gain: 0.8 },
      { soundId: "catch-fire", slot: null, gain: 1 },
    ]);
  });

  it("should stay silent when an object moment has no sound", () => {
    const frame = snapshot({
      world: world({ objectMomentCount: 1, objectSounds: [{ seq: 0, soundId: "none", gain: 1 }] }),
    });
    expect(cuesAfter(frame)).toEqual([]);
  });
});

describe("readSoundCues — blobs on fire", () => {
  it("should play the catch-fire whoosh for the blob when it catches fire", () => {
    const frame = snapshot({ players: [player(0, { catchFireCount: 1 }), player(1)] });
    expect(cuesAfter(frame)).toEqual([{ soundId: "catch-fire", slot: 0, gain: 1 }]);
  });

  it("should play the steam hiss for the blob when ice puts its fire out", () => {
    const frame = snapshot({ players: [player(0), player(1, { iceDouseCount: 1 })] });
    expect(cuesAfter(frame)).toEqual([{ soundId: "steam-hiss", slot: 1, gain: 1 }]);
  });

  it("should play each spray's own start sound when a torch or freeze ray starts", () => {
    const events = [
      event({ type: "sprayStarted", itemId: "torch", slot: 0 }),
      event({ type: "sprayStarted", itemId: "freeze-ray", slot: 1 }),
    ];
    expect(cuesAfter(snapshot({ events })).map((c) => [c.soundId, c.slot])).toEqual([
      ["torch-start", 0],
      ["freeze-start", 1],
    ]);
  });
});

describe("readSoundCues — thaw and steam", () => {
  /** Reads frames in order and returns every cue after the first. */
  const cuesOver = (...worlds: SoundWorldSnapshot[]) => {
    let cursor = readSoundCues(null, snapshot({ world: worlds[0] })).cursor;
    return worlds.slice(1).flatMap((next) => {
      const heard = readSoundCues(cursor, snapshot({ world: next }));
      cursor = heard.cursor;
      return heard.cues;
    });
  };

  it("should play a thaw at most once per element cue window when ground keeps thawing", () => {
    const step = SOUND_MIX.elementCueSeconds / 5;
    const frames = Array.from({ length: 11 }, (_, i) =>
      world({ timeSeconds: i * step, thawedSamples: i * 2 })
    );
    expect(idsOf(cuesOver(...frames))).toEqual(["thaw", "thaw"]);
  });

  it("should scale the thaw's gain with the samples thawed since the last thaw when it plays", () => {
    const [small] = cuesOver(world(), world({ timeSeconds: 1, thawedSamples: 1 }));
    const [full] = cuesOver(
      world(),
      world({ timeSeconds: 1, thawedSamples: SOUND_MIX.thawFullSamples })
    );
    expect(small?.gain).toBeLessThan(full?.gain ?? 0);
    expect(full?.gain).toBe(1);
  });

  it("should hiss steam when the torch melts frozen ground", () => {
    const cues = cuesOver(world(), world({ timeSeconds: 1, torchSlots: [0], frozenVersion: 1 }));
    expect(idsOf(cues)).toEqual(["steam-hiss"]);
  });

  it("should hiss steam at most once per element cue window when beams keep clashing", () => {
    const step = SOUND_MIX.elementCueSeconds / 5;
    const frames = Array.from({ length: 11 }, (_, i) =>
      world({ timeSeconds: i * step, beamClashes: i === 0 ? 0 : 1 })
    );
    // Two windows of clashing: a hiss when it starts, and one per window after that.
    expect(idsOf(cuesOver(...frames))).toEqual(["steam-hiss", "steam-hiss"]);
  });

  it("should stay quiet when the freeze ray changes frozen ground", () => {
    const cues = cuesOver(world(), world({ timeSeconds: 1, freezeSlots: [0], frozenVersion: 1 }));
    expect(cues).toEqual([]);
  });
});

describe("readSoundLoops", () => {
  it("should hold no loops when nothing sprays or burns", () => {
    expect(readSoundLoops(world())).toEqual([]);
  });

  it("should hold a pitched loop per spraying player when torches and freeze rays spray", () => {
    const loops = readSoundLoops(world({ torchSlots: [0, 2], freezeSlots: [1] }));
    expect(loops.map((loop) => [loop.key, loop.soundId, loop.slot])).toEqual([
      ["torch-0", "torch-loop", 0],
      ["torch-2", "torch-loop", 2],
      ["freeze-1", "freeze-loop", 1],
    ]);
  });

  it("should stay silent for a driven kart while its engine takes are not in the sound bank", () => {
    const engines = [{ key: "kart-0", slot: 1, speed: 0.5 }];
    const loops = readSoundLoops(world({ kartEngines: engines }));
    const hasTakes = Object.values(KART_ENGINE_SOUNDS).every((id) => SOUND_FILES[id]);
    if (hasTakes) {
      // Once wired: idle and drive both pitched by the driver, crossfaded at equal power.
      expect(loops.map((loop) => loop.slot)).toEqual([1, 1]);
      expect(loops[0]!.gain ** 2 + loops[1]!.gain ** 2).toBeCloseTo(1, 5);
    } else {
      expect(loops).toEqual([]);
    }
  });

  it("should make the fire crackle louder when more burns", () => {
    const gainAt = (patch: Partial<SoundWorldSnapshot>) =>
      readSoundLoops(world(patch)).find((loop) => loop.key === "fire")?.gain ?? 0;
    expect(gainAt({ burningSamples: 1 })).toBeCloseTo(JUICE_VOLUME.minGain, 2);
    expect(gainAt({ burningSamples: 1 })).toBeLessThan(gainAt({ burningBlobs: 1 }));
    expect(gainAt({ burningSamples: SOUND_MIX.fireFullSamples })).toBe(1);
  });

  it("should play the ice block's own sounds when a blob freezes, cracks its block or the block breaks", () => {
    const froze = snapshot({ players: [player(0, { frozenCount: 1 }), player(1)] });
    expect(cuesAfter(froze)).toEqual([{ soundId: "freeze-solid", slot: 0, gain: 1 }]);
    const cracked = snapshot({ players: [player(0, { iceCrackCount: 1 }), player(1)] });
    expect(cuesAfter(cracked)).toEqual([
      { soundId: "ice-crack", slot: 0, gain: SOUND_MIX.crouchGain },
    ]);
    const broke = snapshot({ players: [player(0), player(1, { iceShatterCount: 1 })] });
    expect(cuesAfter(broke)).toEqual([{ soundId: "ice-shatter", slot: 1, gain: 1 }]);
  });
});

describe("readSoundCues — contact jitter guard", () => {
  it("should not cue a land when the touchdown is slower than the landing minimum", () => {
    const nudge = { landCount: 1, lastLandingSpeed: SOUND_MIX.landingMinSpeed - 1 };
    expect(cuesAfter(snapshot({ players: [player(0, nudge), player(1)] }))).toEqual([]);
  });

  it("should drop a blob's repeat of its own sound when it comes sooner than the body re-trigger time", () => {
    const at = (time: number, lands: number) =>
      snapshot({
        players: [player(0, { landCount: lands, lastLandingSpeed: 600 }), player(1)],
        world: world({ timeSeconds: time }),
      });
    const gap = SOUND_MIX.bodyRetriggerSeconds;
    let cursor = readSoundCues(null, at(0, 0)).cursor;
    const heard = [at(0.01, 1), at(0.01 + gap / 2, 2), at(0.01 + gap, 3)].map((frame) => {
      const read = readSoundCues(cursor, frame);
      cursor = read.cursor;
      return idsOf(read.cues);
    });
    expect(heard).toEqual([["land"], [], ["land"]]);
  });

  it("should keep each blob's own sounds apart when two blobs land on the same frame", () => {
    const lands = { landCount: 1, lastLandingSpeed: 600 };
    const cues = cuesAfter(snapshot({ players: [player(0, lands), player(1, lands)] }));
    expect(cues.map((cue) => `${cue.soundId}:${cue.slot}`)).toEqual(["land:0", "land:1"]);
  });
});
