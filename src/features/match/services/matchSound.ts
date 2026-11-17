import {
  FINAL_MUSIC_SECONDS,
  musicTrackFor,
  readSoundCues,
  type AudioEngine,
  type SoundCursor,
  type SoundSnapshot,
} from "@/features/sound/api/soundApi";
import type { Vec2 } from "@/shared/types/gameGeometry.types";
import { getCellInfo, type TerrainGrid } from "@/features/arena/api/arenaApi";
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

/**
 * What the sound feature reads from one frame of the match. Only the match knows `GameState`,
 * so it hands sound a flat snapshot of the slices it needs (players, dive, combat events, round).
 */
export function soundSnapshotOf(state: GameState): SoundSnapshot {
  return {
    players: state.players.map((player) => {
      const dive = state.dive.motions[player.id];
      return {
        slot: player.slot,
        jumpCount: player.jumpCount,
        wallJumpCount: player.wallJumpCount,
        landCount: player.landCount,
        lastLandingSpeed: player.lastLandingSpeed,
        tumbleBounceCount: player.tumbleBounceCount,
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
        catchFireCount: state.fire.caughtCounts[player.id] ?? 0,
        iceDouseCount: state.fire.dousedCounts[player.id] ?? 0,
      };
    }),
    events: state.combat.events,
    roundPhase: state.round.phase,
  };
}

/**
 * A session's sound on the app's audio engine: plays each frame's cues and the round's music
 * (match loop, the final piece in the last 30 s, silence once ended); `newRound` makes the next
 * frame cue the round start. Dispose fades the music out; the engine itself lives on.
 */
export interface MatchSound {
  hear(state: GameState): void;
  newRound(): void;
  dispose(): void;
}

export function createMatchSound(engine: AudioEngine): MatchSound {
  let cursor: SoundCursor | null = null;
  return {
    hear: (state) => {
      const heard = readSoundCues(cursor, soundSnapshotOf(state));
      cursor = heard.cursor;
      heard.cues.forEach(engine.playCue);
      const { round } = state;
      // The final piece starts in time with the clock, so it lands on the round end.
      const offset = Math.max(0, FINAL_MUSIC_SECONDS - round.remainingSeconds);
      engine.playMusic(musicTrackFor(round), offset);
    },
    newRound: () => {
      cursor = null;
    },
    dispose: () => engine.playMusic(null),
  };
}
