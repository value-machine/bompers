import {
  FINAL_MUSIC_SECONDS,
  musicTrackFor,
  readSoundCues,
  readSoundLoops,
  type AudioEngine,
  type SoundBurst,
  type SoundCursor,
  type SoundSnapshot,
  type SoundWorldSnapshot,
} from "@/features/sound/api/soundApi";
import type { Vec2 } from "@/shared/types/gameGeometry.types";
import { frozenVersionOf, getCellInfo, type TerrainGrid } from "@/features/arena/api/arenaApi";
import { burningCount } from "@/features/fire/api/fireApi";
import { thawedCount } from "@/features/ice/api/iceApi";
import { resolveCatalogEntry } from "@/features/content-catalog/api/contentCatalogApi";
import type { PlayerState } from "@/features/player/api/playerApi";
import { isInPlay } from "@/features/match/services/matchRules";
import type { GameState } from "@/features/match/services/gameSim";

/**
 * Catalog sound of the wall a dive bonked into: the first solid cell just past the body along the
 * dive's main axis, then its other axis (a diagonal dive can bonk on either). The sims stay
 * untouched: the bonk frame still has the blob pressed against the wall (material-sounds D3).
 */
export function bonkedMaterialSound(terrain: TerrainGrid, player: PlayerState, dir: Vec2): string {
  const center = { x: player.x, y: player.y - player.height / 2 };
  const reach = {
    x: player.width / 2 + terrain.cellSize / 2,
    y: player.height / 2 + terrain.cellSize / 2,
  };
  const probes =
    Math.abs(dir.x) >= Math.abs(dir.y)
      ? [
          { x: Math.sign(dir.x), y: 0 },
          { x: 0, y: Math.sign(dir.y) },
        ]
      : [
          { x: 0, y: Math.sign(dir.y) },
          { x: Math.sign(dir.x), y: 0 },
        ];
  for (const probe of probes) {
    if (probe.x === 0 && probe.y === 0) continue;
    const x = center.x + probe.x * reach.x;
    const y = center.y + probe.y * reach.y;
    const cell = getCellInfo(
      terrain,
      Math.floor(x / terrain.cellSize),
      Math.floor(y / terrain.cellSize)
    );
    if (cell) return resolveCatalogEntry("material", cell.materialId).entry?.sound ?? "none";
  }
  return "none";
}

/** A player's ice block counters (ice-frozen-blobs D2): frozen, cracks, blocks broken. */
const iceBlockCounts = (state: GameState, id: string) => ({
  frozenCount: state.ice.frozeCounts[id] ?? 0,
  iceCrackCount: state.ice.crackCounts[id] ?? 0,
  iceShatterCount: state.ice.shatterCounts[id] ?? 0,
});

/**
 * Fire and ice as sound hears them: who sprays what this step, how much burns, how much has
 * thawed by itself (the ice FIFO's head only moves forward) and the frozen-flag version.
 */
export function soundWorldOf(state: GameState): SoundWorldSnapshot {
  const { fire, ice } = state;
  return {
    timeSeconds: state.timeSeconds,
    torchSlots: fire.sprays.map((spray) => spray.slot),
    freezeSlots: ice.rays.map((ray) => ray.slot),
    burningSamples: burningCount(fire),
    burningBlobs: state.blobFire.blobs.size,
    thawedSamples: thawedCount(ice),
    frozenVersion: frozenVersionOf(state.arena.terrain),
    beamClashes: state.combat.beamClashes.length,
  };
}

/**
 * What the sound feature reads from one frame of the match. Only the match knows `GameState`,
 * so it hands sound a flat snapshot of the slices it needs (players, dive, combat events, round).
 */
export function soundSnapshotOf(
  state: GameState,
  bursts: readonly SoundBurst[] = []
): SoundSnapshot {
  return {
    players: state.players.map((player) => {
      const dive = state.dive.motions[player.id];
      return {
        slot: player.slot,
        jumpCount: player.jumpCount,
        wallJumpCount: player.wallJumpCount,
        landCount: player.landCount,
        lastLandingSpeed: player.lastLandingSpeed,
        rollBounceCount: player.rollBounceCount,
        moveRollCount: player.moveRollCount,
        rollRestCount: player.rollRestCount,
        crouchCount: player.crouchCount,
        inPlay: isInPlay(state.rules, player),
        divePhase: dive?.phase ?? "idle",
        diveBonked: dive?.bonked ?? false,
        diveBonkSoundId: dive?.bonked
          ? bonkedMaterialSound(state.arena.terrain, player, { x: dive.dirX, y: dive.dirY })
          : "none",
        speed: Math.hypot(player.vx, player.vy),
        terrainHitSpeed: Math.max(player.terrainHitSpeedX, player.terrainHitSpeedY),
        diveRefillCount: state.dive.refillCounts[player.id] ?? 0,
        catchFireCount: state.blobFire.caughtCounts[player.id] ?? 0,
        iceDouseCount: state.blobFire.dousedCounts[player.id] ?? 0,
        ...iceBlockCounts(state, player.id),
      };
    }),
    events: state.combat.events,
    roundPhase: state.round.phase,
    world: soundWorldOf(state),
    bursts,
  };
}

/**
 * A session's sound on the app's audio engine: plays each frame's cues and the round's music
 * (match loop, the final piece in the last 30 s, silence once ended); `newRound` makes the next
 * frame cue the round start. Dispose fades the music out; the engine itself lives on.
 */
export interface MatchSound {
  /** `bursts`: the knockout layer's burst log after this frame's render step (the splats). */
  hear(state: GameState, bursts: readonly SoundBurst[]): void;
  newRound(): void;
  dispose(): void;
}

export function createMatchSound(engine: AudioEngine): MatchSound {
  let cursor: SoundCursor | null = null;
  return {
    hear: (state, bursts) => {
      const frame = soundSnapshotOf(state, bursts);
      const heard = readSoundCues(cursor, frame);
      cursor = heard.cursor;
      heard.cues.forEach(engine.playCue);
      // Held sounds stop with the round; unrefreshed (paused, closed) they fade by themselves.
      engine.setLoops(state.round.phase === "ended" ? [] : readSoundLoops(frame.world));
      const { round } = state;
      // The final piece starts in time with the clock, so it lands on the round end.
      const offset = Math.max(0, FINAL_MUSIC_SECONDS - round.remainingSeconds);
      engine.playMusic(musicTrackFor(round), offset);
    },
    newRound: () => {
      cursor = null;
    },
    dispose: () => {
      engine.playMusic(null);
      engine.setLoops([]);
    },
  };
}
