import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { SprayParticleLook, SprayStepHits } from "@/shared/types/sprayParticles.types";
import {
  advanceSpray,
  createSprayStream,
  emitSpray,
  sprayStreamEmpty,
} from "@/shared/utils/sprayParticles";
import { terrainBodies, type TerrainGrid } from "@/features/arena/api/arenaApi";
import { helmetPoint } from "@/features/combat/api/combatApi";
import { hurtHeight, weaponAim, type PlayerState } from "@/features/player/api/playerApi";
import { chillBlob } from "@/features/ice/services/frozenBlobs";
import { feedCold } from "@/features/ice/services/iceSim";
import type { FreezeSpray, IceState } from "@/features/ice/types/ice.types";

/**
 * The freeze ray (owner, ice-element D1) as a stream of puffs (owner, freeze-ray-particles D1,
 * "Cold travels"): while its holder holds fire it emits puffs across its fan at the aim of that
 * moment (the shared spray particle stream, `sprayParticles.ts`), and each puff keeps its own
 * heading, so turning or spinning bends the spray into an arc or a spiral. The cold travels with
 * the puffs: a puff that lands on terrain or a moving part stops there and the ice grows from it
 * (`feedCold`, D3, D8); a blob a puff passes through gathers chill (`chillBlob`) and is pushed
 * lightly along the puffs' heading. Let go, and the puffs already in flight fly on and still act.
 */
export interface FreezeRayArgs {
  terrain: TerrainGrid;
  /** Players in play (the holder too; its own puffs never touch it). */
  players: readonly PlayerState[];
  holder: PlayerState;
  tunables: GameTunables;
  /** Sim time of this step, seconds. */
  now: number;
  dt: number;
  /** How far the puffs fly this step (shorter in a beam clash); the ray's length when left out. */
  reach?: number;
  /** Blobs the puffs may chill (not one in a dive or under spawn protection); all when left out. */
  canChill?: (player: PlayerState) => boolean;
}

export type FreezeSpraysArgs = Omit<FreezeRayArgs, "holder" | "reach">;

/** The freeze ray's puffs as the shared stream sees them. */
export const freezePuffLook = (tunables: GameTunables): SprayParticleLook => {
  const ray = tunables.combat.freezeRay;
  return {
    rate: ray.puffRate,
    speed: ray.puffSpeed,
    length: ray.length,
    halfAngleDegrees: ray.halfAngleDegrees,
    cap: ray.puffCap,
    burstSeconds: ray.burstSeconds,
  };
};

/**
 * The cold flows on the bodies the puffs landed on this step: the ground or a moving part
 * (mover-materials lap 2b). Puffs split over bodies split the step's ice by the puffs on each,
 * so a step never makes more ice than one ray's worth, however many puffs land.
 */
function feedLanded(
  ice: IceState,
  hits: SprayStepHits<PlayerState>,
  at: { slot: number } & FreezeSpraysArgs
): void {
  const byBody = new Map<number, number[]>();
  for (const hit of hits.terrain)
    byBody.set(hit.body, [...(byBody.get(hit.body) ?? []), hit.sample]);
  const landed = hits.terrain.length;
  const { terrain, tunables, now, dt, slot } = at;
  for (const [body, samples] of byBody) {
    const share = samples.length / landed;
    feedCold(ice, terrain, { slot, body, samples, share, now, dt, tunables });
  }
}

/** Chill and push each blob a puff reached this step, once whatever the number of puffs. */
function chillReached(ice: IceState, hits: SprayStepHits<PlayerState>, at: FreezeSpraysArgs): void {
  const { tunables, now, dt, terrain } = at;
  const push = tunables.combat.freezeRay.push * dt;
  for (const [blob, heading] of hits.bodies) {
    const length = Math.hypot(heading.x, heading.y) || 1;
    blob.vx += (heading.x / length) * push;
    blob.vy += (heading.y / length) * push;
    if (at.canChill && !at.canChill(blob)) continue;
    chillBlob(ice, blob, { now, dt, terrain, tunables });
  }
}

/** Flies one spray's puffs a step and lets them act. */
function flySpray(ice: IceState, spray: FreezeSpray, at: FreezeSpraysArgs): void {
  const hits = advanceSpray(spray.stream, {
    fields: terrainBodies(at.terrain),
    bodies: at.players.filter((player) => player.slot !== spray.slot),
    hitHeight: hurtHeight,
    dt: at.dt,
    now: at.now,
    look: freezePuffLook(at.tunables),
    reach: spray.reach,
  });
  feedLanded(ice, hits, { ...at, slot: spray.slot });
  chillReached(ice, hits, at);
}

/** One step of holding the ray: emit this step's puffs at the aim, then fly and act. */
export function sprayFreezeRay(ice: IceState, args: FreezeRayArgs): void {
  const { holder, tunables } = args;
  let spray = ice.sprays.find((candidate) => candidate.slot === holder.slot);
  if (!spray) {
    spray = {
      slot: holder.slot,
      stream: createSprayStream(),
      held: true,
      heldAt: args.now,
      reach: 0,
    };
    ice.sprays.push(spray);
  }
  spray.held = true;
  spray.heldAt = args.now;
  spray.reach = args.reach ?? tunables.combat.freezeRay.length;
  emitSpray(spray.stream, {
    origin: helmetPoint(holder),
    aim: weaponAim(holder),
    dt: args.dt,
    look: freezePuffLook(tunables),
  });
  flySpray(ice, spray, args);
}

/**
 * The puffs of every ray not held this step fly on (match step 3, after combat): they still land,
 * freeze and chill. A spray whose last puff has landed and whose bursts are done is dropped.
 */
export function stepFreezeSprays(ice: IceState, args: FreezeSpraysArgs): void {
  for (const spray of ice.sprays) {
    if (spray.heldAt >= args.now) continue;
    spray.held = false;
    spray.reach = args.tunables.combat.freezeRay.length;
    flySpray(ice, spray, args);
  }
  ice.sprays = ice.sprays.filter((spray) => spray.held || !sprayStreamEmpty(spray.stream));
}
