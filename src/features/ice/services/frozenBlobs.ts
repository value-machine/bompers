import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { PlayerInputs } from "@/shared/types/gameInput.types";
import { EMPTY_PLAYER_INPUT } from "@/shared/utils/gameInputMapping";
import { endRoll, type PlayerState } from "@/features/player/api/playerApi";
import type { IceBlob, IceBlobMoment, IceState } from "@/features/ice/types/ice.types";

/**
 * Frozen blobs (owner, ice-frozen-blobs D1: the "Ice block"). A blob in a freeze ray gathers
 * chill (half speed while crouching); at `ice.blob.freezeSeconds` it is frozen solid for
 * `frozenSeconds`: its inputs do nothing (`frozenInputs`), it slides with almost no braking
 * and anyone can shove it (`holdFrozenBlobs`). The block ends on the third jump press, a hit
 * (the match calls `releaseBlob`), the timer, or fire (the match melts it). Out of the beam the
 * chill runs back down, so a quick sweep does nothing. No damage.
 */

/** Seconds a crack's drawn hop lasts (the renderer's pose and the block follow it). */
export const CRACK_HOP_SECONDS = 0.2;

export const isFrozen = (ice: IceState, player: PlayerState): boolean =>
  typeof ice.blobs.get(player.id)?.frozenAt === "number";

/** Chilled or frozen: any ice on the blob (fire cancels it). */
export const isIced = (ice: IceState, player: PlayerState): boolean => ice.blobs.has(player.id);

interface At {
  now: number;
  tunables: GameTunables;
}

function addMoment(
  ice: IceState,
  player: PlayerState,
  look: { kind: IceBlobMoment["kind"]; now: number }
) {
  ice.blobMoments.push({
    kind: look.kind,
    slot: player.slot,
    at: { x: player.x, y: player.y - player.height / 2 },
    atSeconds: look.now,
  });
}

const bump = (counts: Record<string, number>, id: string): void => {
  counts[id] = (counts[id] ?? 0) + 1;
};

function freeze(ice: IceState, player: PlayerState, at: { blob: IceBlob; now: number }): void {
  const { blob, now } = at;
  blob.frozenAt = now;
  blob.cracks = 0;
  // Held at the freeze is not a press: the first crack needs a fresh one.
  blob.jumpHeld = true;
  endRoll(player);
  bump(ice.frozeCounts, player.id);
  addMoment(ice, player, { kind: "frozen", now });
}

/**
 * One step of a freeze ray on a blob: adds `dt` of chill (half while crouching) and freezes it
 * when full. Nothing while it is frozen already or its last block just ended.
 */
export function chillBlob(ice: IceState, player: PlayerState, step: At & { dt: number }): void {
  const { now, tunables } = step;
  const t = tunables.ice.blob;
  if (now < (ice.blobGraceUntil.get(player.id) ?? -Infinity)) return;
  let blob = ice.blobs.get(player.id);
  if (!blob) {
    blob = {
      slot: player.slot,
      chill: 0,
      chilledAt: now,
      frozenAt: null,
      cracks: 0,
      crackedAt: -Infinity,
      jumpHeld: false,
    };
    ice.blobs.set(player.id, blob);
  }
  if (blob.frozenAt !== null) return;
  blob.chilledAt = now;
  blob.chill += step.dt * (player.crouching ? t.crouchChillScale : 1);
  // A hair under the threshold still freezes: step sizes do not add up exactly.
  if (blob.chill >= t.freezeSeconds - 1e-9) freeze(ice, player, { blob, now });
}

/**
 * Takes the ice off a blob: `shatter` breaks a block into shards, `melt` is fire. A block that
 * ends starts the grace; chill that had not frozen yet just goes. False when there was no ice.
 */
export function releaseBlob(
  ice: IceState,
  player: PlayerState,
  how: At & { kind: "shatter" | "melt" }
): boolean {
  const blob = ice.blobs.get(player.id);
  if (!blob) return false;
  ice.blobs.delete(player.id);
  if (blob.frozenAt === null) return true;
  ice.blobGraceUntil.set(player.id, how.now + how.tunables.ice.blob.graceSeconds);
  if (how.kind === "shatter") bump(ice.shatterCounts, player.id);
  addMoment(ice, player, { kind: how.kind, now: how.now });
  return true;
}

/**
 * The inputs the sim runs on (before step 2): a frozen blob's are emptied, so it cannot move,
 * aim, fire, crouch or dive (D7). Its jump presses crack the block instead; the last one of
 * `ice.blob.cracksToBreak` breaks it open, and that step's input already counts again.
 */
export function frozenInputs(
  ice: IceState,
  players: readonly PlayerState[],
  step: At & { inputs: PlayerInputs }
): PlayerInputs {
  if (ice.blobs.size === 0) return step.inputs;
  return step.inputs.map((input, slot) => {
    const player = players.find((candidate) => candidate.slot === slot);
    const blob = player ? ice.blobs.get(player.id) : undefined;
    if (!player || !blob || blob.frozenAt === null) return input;
    const pressed = input.jump && !blob.jumpHeld;
    blob.jumpHeld = input.jump;
    if (pressed) {
      blob.cracks += 1;
      blob.crackedAt = step.now;
      if (blob.cracks >= step.tunables.ice.blob.cracksToBreak) {
        releaseBlob(ice, player, { kind: "shatter", now: step.now, tunables: step.tunables });
        // The breaking press is spent on the block: no jump out of it this step.
        return { ...input, jump: false };
      }
      bump(ice.crackCounts, player.id);
      addMoment(ice, player, { kind: "crack", now: step.now });
    }
    return { ...EMPTY_PLAYER_INPUT, connected: input.connected, pause: input.pause };
  });
}

export interface StepFrozenBlobsArgs extends At {
  /** Players in play; a blob that left play loses its ice without a moment. */
  players: readonly PlayerState[];
  dt: number;
}

/**
 * One step of the blobs' ice, after the rays of this step: chill no ray fed runs back down, a
 * block whose time is over breaks, old moments go.
 */
export function stepFrozenBlobs(ice: IceState, args: StepFrozenBlobsArgs): void {
  const { now, tunables } = args;
  const t = tunables.ice.blob;
  ice.blobMoments = ice.blobMoments.filter((moment) => moment.atSeconds >= now - t.momentSeconds);
  if (ice.blobs.size === 0) return;
  const inPlay = new Map(args.players.map((player) => [player.id, player]));
  for (const [id, blob] of [...ice.blobs]) {
    const player = inPlay.get(id);
    if (!player) {
      ice.blobs.delete(id);
    } else if (blob.frozenAt !== null) {
      if (now - blob.frozenAt >= t.frozenSeconds)
        releaseBlob(ice, player, { kind: "shatter", now, tunables });
    } else if (blob.chilledAt < now) {
      blob.chill -= args.dt;
      if (blob.chill <= 0) ice.blobs.delete(id);
    }
  }
}

/**
 * The block as a puck (D4): a frozen blob brakes at `ice.blob.slideGrip` of normal (times the
 * ground's own grip, so frozen ground carries it far) and cannot jump. Written through the
 * controller's motion modifiers at the end of the step, after the dive has set them, for the
 * controller's next step.
 */
export function holdFrozenBlobs(
  ice: IceState,
  players: readonly PlayerState[],
  tunables: GameTunables
): void {
  if (ice.blobs.size === 0) return;
  for (const player of players) {
    if (!isFrozen(ice, player)) continue;
    player.steerScale = Math.min(player.steerScale, tunables.ice.blob.slideGrip);
    player.jumpLocked = true;
  }
}
