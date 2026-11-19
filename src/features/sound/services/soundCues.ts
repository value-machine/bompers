import { intensityGain } from "@/shared/config/gameJuice";
import type { CombatEvent } from "@/features/combat/api/combatApi";
import { SOUND_MIX } from "@/features/sound/services/soundBank";
import type {
  SoundBurst,
  SoundCue,
  SoundLoop,
  SoundPlayerSnapshot,
  SoundWorldSnapshot,
} from "@/features/sound/types/sound.types";

/** Everything the cue reader needs from one frame of the match. */
export interface SoundSnapshot {
  players: readonly SoundPlayerSnapshot[];
  /** Combat's event log (read by `seq`). */
  events: readonly CombatEvent[];
  roundPhase: "playing" | "ended";
  /** Fire and ice this frame (thaw and steam cues, the held loops). */
  world: SoundWorldSnapshot;
  /** The knockout layer's burst log (read by `n`): the death sound plays on the splat. */
  bursts: readonly SoundBurst[];
}

/** When the rate-limited element cues last played, and what had thawed by then. */
interface ElementCueMarks {
  thawAt: number;
  thawedAtCue: number;
  steamAt: number;
}

/** What the reader remembers between frames. A fresh round starts from `null`. */
export interface SoundCursor {
  lastSeq: number;
  /** Newest knockout burst already read. */
  lastBurst: number;
  players: ReadonlyMap<number, SoundPlayerSnapshot>;
  roundPhase: "playing" | "ended";
  world: SoundWorldSnapshot;
  marks: ElementCueMarks;
  /** When each player's own sounds last played (sim seconds), by `bodyCueKey`. */
  bodyCueAt: ReadonlyMap<string, number>;
}

/**
 * Turns one frame of the match into sound cues: combat events by `seq` (combat D3), the
 * players' monotonic event counters (jump, land, roll bounce, roll start / rest), dive phase changes, respawns
 * and the round phase. Pure: the caller keeps the returned cursor for the next frame, and a
 * fresh round starts from a `null` cursor (which cues the round start).
 */
export function readSoundCues(
  cursor: SoundCursor | null,
  frame: SoundSnapshot
): { cursor: SoundCursor; cues: SoundCue[] } {
  const lastSeq = cursor?.lastSeq ?? 0;
  const lastBurst = cursor?.lastBurst ?? 0;
  const elements = elementCues(cursor, frame.world);
  const body = guardBodyCues(
    cursor?.bodyCueAt ?? new Map(),
    frame.players.flatMap((player) => playerCues(cursor?.players.get(player.slot), player)),
    frame.world.timeSeconds
  );
  const cues = [
    ...roundCues(cursor, frame),
    ...body.cues,
    ...eventCues(frame, lastSeq),
    ...burstCues(frame, lastBurst),
    ...elements.cues,
  ];
  return {
    cues,
    cursor: {
      lastSeq: frame.events.reduce((max, event) => Math.max(max, event.seq), lastSeq),
      lastBurst: frame.bursts.reduce((max, burst) => Math.max(max, burst.n), lastBurst),
      players: new Map(frame.players.map((player) => [player.slot, player])),
      roundPhase: frame.roundPhase,
      world: frame.world,
      marks: elements.marks,
      bodyCueAt: body.at,
    },
  };
}

const bodyCueKey = (cue: SoundCue): string => `${cue.slot ?? "-"}:${cue.soundId}`;

/**
 * The re-trigger guard per body and sound (collision-sound-jitter): a player's own sound that
 * played less than `SOUND_MIX.bodyRetriggerSeconds` ago (sim time) is dropped, so a contact that
 * keeps re-touching never machine-guns one blob's landing. Other blobs and other sounds are free.
 */
function guardBodyCues(
  lastAt: ReadonlyMap<string, number>,
  cues: readonly SoundCue[],
  timeSeconds: number
): { cues: SoundCue[]; at: ReadonlyMap<string, number> } {
  const at = new Map(lastAt);
  const kept = cues.filter((cue) => {
    const key = bodyCueKey(cue);
    if (timeSeconds - (at.get(key) ?? -Infinity) < SOUND_MIX.bodyRetriggerSeconds) return false;
    at.set(key, timeSeconds);
    return true;
  });
  return { cues: kept, at };
}

/**
 * The held sounds for this frame: a torch loop and a freeze loop per player spraying (pitched by
 * the player), and one fire crackle for the whole world, louder the more burns (blobs on fire
 * count as `SOUND_MIX.fireBlobSamples` samples each). Pure; the engine fades loops in and out.
 */
export function readSoundLoops(world: SoundWorldSnapshot): SoundLoop[] {
  const loops: SoundLoop[] = [
    ...world.torchSlots.map((slot) => ({
      key: `torch-${slot}`,
      soundId: "torch-loop",
      slot,
      gain: 1,
    })),
    ...world.freezeSlots.map((slot) => ({
      key: `freeze-${slot}`,
      soundId: "freeze-loop",
      slot,
      gain: 1,
    })),
  ];
  const fire = world.burningSamples + world.burningBlobs * SOUND_MIX.fireBlobSamples;
  if (fire > 0) {
    const gain = intensityGain(fire, SOUND_MIX.fireFullSamples);
    loops.push({ key: "fire", soundId: "fire-crackle", slot: null, gain });
  }
  return loops;
}

/** Frozen ground changed while only a torch sprays and nothing thawed by itself: the torch melted it. */
const torchMelted = (previous: SoundWorldSnapshot, world: SoundWorldSnapshot): boolean =>
  world.frozenVersion !== previous.frozenVersion &&
  world.thawedSamples === previous.thawedSamples &&
  world.torchSlots.length > 0 &&
  world.freezeSlots.length === 0;

const NO_MARKS: ElementCueMarks = { thawAt: -Infinity, thawedAtCue: 0, steamAt: -Infinity };

/**
 * Ground thawing and the torch melting frozen ground, each at most once per
 * `SOUND_MIX.elementCueSeconds` (a thawing patch thaws a sample at a time). A thaw is as loud as
 * the samples thawed since the last thaw cue; the torch's melt is a steam hiss. A frozen-flag
 * change while a torch sprays and no freeze ray does, with no thaw of its own, is the torch's melt.
 * Beams ending each other (beam-clash D1) hiss the same way for as long as the clash holds.
 */
function elementCues(
  cursor: SoundCursor | null,
  world: SoundWorldSnapshot
): { cues: SoundCue[]; marks: ElementCueMarks } {
  const marks = { ...(cursor?.marks ?? { ...NO_MARKS, thawedAtCue: world.thawedSamples }) };
  const previous = cursor?.world;
  if (!previous) return { cues: [], marks };
  const cues: SoundCue[] = [];
  const due = (at: number): boolean => world.timeSeconds - at >= SOUND_MIX.elementCueSeconds;
  const thawed = world.thawedSamples - marks.thawedAtCue;
  if (world.thawedSamples > previous.thawedSamples && due(marks.thawAt)) {
    cues.push(cue("thaw", null, intensityGain(thawed, SOUND_MIX.thawFullSamples)));
    marks.thawAt = world.timeSeconds;
    marks.thawedAtCue = world.thawedSamples;
  }
  if ((torchMelted(previous, world) || world.beamClashes > 0) && due(marks.steamAt)) {
    cues.push(cue("steam-hiss", null));
    marks.steamAt = world.timeSeconds;
  }
  return { cues, marks };
}

const cue = (soundId: string, slot: number | null, gain = 1): SoundCue => ({ soundId, slot, gain });

function roundCues(cursor: SoundCursor | null, frame: SoundSnapshot): SoundCue[] {
  if (cursor === null) return [cue("round-start", null)];
  const ended = cursor.roundPhase === "playing" && frame.roundPhase === "ended";
  return ended ? [cue("round-end", null)] : [];
}

/**
 * The blob part of a head-on wall bonk: the landing splut (owner's swap, material-sounds D5).
 * Dive hits on another player keep `dive-impact`.
 */
export const WALL_BONK_SOUND = "land";

type PlayerRule = (previous: SoundPlayerSnapshot, now: SoundPlayerSnapshot) => boolean;

/** Player-state changes that cue a sound, in play order, with each one's gain. */
const PLAYER_RULES: readonly [
  soundId: string,
  fired: PlayerRule,
  gain: (now: SoundPlayerSnapshot) => number,
][] = [
  ["jump", (p, n) => n.jumpCount > p.jumpCount || n.wallJumpCount > p.wallJumpCount, () => 1],
  [
    "land",
    // A touchdown slower than `landingMinSpeed` is a nudge (a hop off a pushing part), not a landing.
    (p, n) => n.landCount > p.landCount && n.lastLandingSpeed >= SOUND_MIX.landingMinSpeed,
    (n) => intensityGain(n.lastLandingSpeed, SOUND_MIX.landingFullSpeed),
  ],
  // The roll bounce keeps the `tumble-bounce` file (shared-roll D8).
  ["tumble-bounce", (p, n) => n.rollBounceCount > p.rollBounceCount, () => 1],
  // Rolling on from a dash, and a roll coming to rest: a soft thud, like a crouch.
  ["land", (p, n) => n.moveRollCount > p.moveRollCount, () => SOUND_MIX.crouchGain],
  ["land", (p, n) => n.rollRestCount > p.rollRestCount, () => SOUND_MIX.crouchGain],
  ["dive-launch", (p, n) => n.divePhase === "travel" && p.divePhase !== "travel", () => 1],
  ["respawn", (p, n) => n.inPlay && !p.inPlay, () => 1],
  // A headbutt reset reuses the pickup sound, pitched by the collector (headbutt-reset D5).
  ["pickup", (p, n) => n.diveRefillCount > p.diveRefillCount, () => 1],
  // A blob catching fire, and ice putting it out with steam (owner picks, element-sounds lap).
  ["catch-fire", (p, n) => n.catchFireCount > p.catchFireCount, () => 1],
  ["steam-hiss", (p, n) => n.iceDouseCount > p.iceDouseCount, () => 1],
  // The ice block (owner picks, ice-block-sounds lap): a blob freezing, a jump press cracking its
  // block (softer), the block breaking.
  ["freeze-solid", (p, n) => n.frozenCount > p.frozenCount, () => 1],
  ["ice-crack", (p, n) => n.iceCrackCount > p.iceCrackCount, () => SOUND_MIX.crouchGain],
  ["ice-shatter", (p, n) => n.iceShatterCount > p.iceShatterCount, () => 1],
];

const bonked = (previous: SoundPlayerSnapshot, now: SoundPlayerSnapshot): boolean =>
  now.divePhase === "recovery" && now.diveBonked && previous.divePhase === "travel";

/**
 * A head-on wall bonk: the blob's splut (pitched) plus the wall's material sound (unpitched),
 * both as loud as the bonk was hard.
 */
function bonkCues(now: SoundPlayerSnapshot): SoundCue[] {
  const gain = intensityGain(now.terrainHitSpeed, SOUND_MIX.hitFullSpeed);
  const cues = [cue(WALL_BONK_SOUND, now.slot, gain)];
  if (now.diveBonkSoundId !== "none") cues.push(cue(now.diveBonkSoundId, null, gain));
  return cues;
}

function playerCues(
  previous: SoundPlayerSnapshot | undefined,
  now: SoundPlayerSnapshot
): SoundCue[] {
  if (!previous) return [];
  const cues = PLAYER_RULES.filter(([, fired]) => fired(previous, now)).map(([soundId, , gain]) =>
    cue(soundId, now.slot, gain(now))
  );
  if (bonked(previous, now)) cues.push(...bonkCues(now));
  // Sinking into a crouch is a soft landing thud (no file of its own).
  if (now.crouchCount > previous.crouchCount)
    cues.push(cue("land", now.slot, SOUND_MIX.crouchGain));
  return cues;
}

function eventCues(frame: SoundSnapshot, lastSeq: number): SoundCue[] {
  const speedOf = (slot: number): number =>
    frame.players.find((player) => player.slot === slot)?.speed ?? 0;
  return frame.events
    .filter((event) => event.seq > lastSeq)
    .flatMap((event) => {
      // A crush (moving parts, owner B2): the wet splut of being squeezed; the pop follows on
      // the pancake's burst (`burstCues`).
      if (event.type === "playerEliminated" && event.cause === "crush")
        return [cue("land", event.victimSlot)];
      const main = combatEventCue(event, speedOf);
      return main ? [main] : [];
    });
}

/**
 * The death sound on the splat (owner, death-splat-sound lap): `elimination` plays when the
 * knocked-out blob bursts into goo, pitched by the victim, not at the lethal hit.
 */
const burstCues = (frame: SoundSnapshot, lastBurst: number): SoundCue[] =>
  frame.bursts
    .filter((burst) => burst.n > lastBurst)
    .map((burst) => cue("elimination", burst.slot));

/**
 * Combat event → cue. Hits and eliminations take the victim's pitch, actions the actor's. A hit is
 * as loud as the victim's knockback speed this frame (`hitFullSpeed`).
 */
const SPRAY_START_SOUND = { torch: "torch-start", "freeze-ray": "freeze-start" } as const;

function combatEventCue(event: CombatEvent, speedOf: (slot: number) => number): SoundCue | null {
  // Events that name their own sound: terrain gone (the material's), a moving part's (the author's).
  if ("soundId" in event) return cue(event.soundId, null);
  switch (event.type) {
    case "playerHit":
      return cue(
        event.source === "dive" ? "dive-impact" : "hit",
        event.victimSlot,
        intensityGain(speedOf(event.victimSlot), SOUND_MIX.hitFullSpeed)
      );
    case "playerEliminated":
      // A knockout's pop waits for its burst (`burstCues`); falling out of the arena makes no
      // knockout, so it pops at once.
      return event.cause === "out-of-bounds" ? cue("elimination", event.victimSlot) : null;
    case "rocketFired":
      return cue("rocket-fire", event.slot);
    case "sprayStarted":
      // The spray's own start; its held loop comes from `readSoundLoops`.
      return cue(SPRAY_START_SOUND[event.itemId], event.slot);
    case "explosion":
      return cue("explosion", null);
    case "pickupCollected":
      return cue("pickup", event.slot);
    default:
      // pickupSpawned: no sound.
      return null;
  }
}
