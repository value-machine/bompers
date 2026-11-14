import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { LevelSettings } from "@/features/level/api/levelApi";
import { applyLevelSettings } from "@/features/match/api/matchApi";
import type { MatchSettings } from "@/features/lobby/types/lobby.types";

/** Match lengths players can pick, in seconds. Must contain the engine default (180). */
export const DURATION_OPTIONS: readonly number[] = [60, 90, 120, 180, 300];

/** Gravity multipliers players can pick, light to heavy. */
export const GRAVITY_OPTIONS: readonly number[] = [0.6, 0.8, 1, 1.25, 1.5];

/** The lobby's starting settings: the engine defaults. */
export const defaultMatchSettings = (tunables: GameTunables): MatchSettings => ({
  durationSeconds: tunables.match.durationSeconds,
  gravityScale: 1,
});

/** The next option after `current` in `step` direction, wrapping; an unknown value starts over. */
export function cycleOption(options: readonly number[], current: number, step: 1 | -1): number {
  const index = options.indexOf(current);
  if (index === -1) return options[0] ?? current;
  return options[(index + step + options.length) % options.length] ?? current;
}

/**
 * The lobby's settings on top of the engine tunables: what the match gets as `tunables`.
 * The level's own settings apply after this, inside `createGameState` (see `effectiveSettings`).
 */
export function applyMatchSettings(tunables: GameTunables, settings: MatchSettings): GameTunables {
  return {
    ...tunables,
    world: { ...tunables.world, gravity: tunables.world.gravity * settings.gravityScale },
    match: { ...tunables.match, durationSeconds: settings.durationSeconds },
  };
}

export interface EffectiveSettings {
  durationSeconds: number;
  /** The level sets its own match length, so the lobby's choice does not apply. */
  durationSetByLevel: boolean;
  /** Lobby gravity × the level's gravity multiplier. */
  gravityScale: number;
}

/**
 * What a round on a level with `levelSettings` will really use, computed through the same
 * `applyLevelSettings` the match calls. Precedence (lobby D2): gravity multiplies (engine ×
 * lobby × level, so a level built for low gravity stays relatively low); a level's
 * `matchDurationS` wins over the lobby's duration.
 */
export function effectiveSettings(
  tunables: GameTunables,
  settings: MatchSettings,
  levelSettings: LevelSettings
): EffectiveSettings {
  const final = applyLevelSettings(applyMatchSettings(tunables, settings), levelSettings);
  return {
    durationSeconds: final.match.durationSeconds,
    durationSetByLevel: levelSettings.matchDurationS !== undefined,
    gravityScale: final.world.gravity / tunables.world.gravity,
  };
}

/** `3:00`-style label. */
export const formatDuration = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;

/** `1.25×`-style label. */
export const formatGravity = (scale: number): string => `${Number(scale.toFixed(2))}×`;
