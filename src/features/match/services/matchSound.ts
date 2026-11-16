import {
  FINAL_MUSIC_SECONDS,
  musicTrackFor,
  readSoundCues,
  type AudioEngine,
  type SoundCursor,
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
        crouchCount: player.crouchCount,
        inPlay: isInPlay(state.rules, player),
        divePhase: dive?.phase ?? "idle",
        diveBonked: dive?.bonked ?? false,
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
