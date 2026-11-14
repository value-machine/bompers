import {
  createSoundPlayer,
  readSoundCues,
  type SoundCursor,
  type SoundHost,
  type SoundSnapshot,
} from "@/features/sound/api/soundApi";
import { isInPlay } from "@/features/match/services/matchRules";
import type { GameState } from "@/features/match/services/gameSim";

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
        inPlay: isInPlay(state.rules, player),
        divePhase: dive?.phase ?? "idle",
        diveBonked: dive?.bonked ?? false,
      };
    }),
    events: state.combat.events,
    roundPhase: state.round.phase,
  };
}

/** A session's sound: plays each frame's cues; `newRound` makes the next frame cue the round start. */
export interface MatchSound {
  hear(state: GameState): void;
  newRound(): void;
  dispose(): void;
}

export function createMatchSound(host: SoundHost): MatchSound {
  const player = createSoundPlayer(host);
  let cursor: SoundCursor | null = null;
  return {
    hear: (state) => {
      const heard = readSoundCues(cursor, soundSnapshotOf(state));
      cursor = heard.cursor;
      heard.cues.forEach(player.play);
    },
    newRound: () => {
      cursor = null;
    },
    dispose: () => player.dispose(),
  };
}
