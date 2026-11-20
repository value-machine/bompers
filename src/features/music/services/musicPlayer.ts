import { MUSIC_FADE_SECONDS, MUSIC_TRACKS } from "@/features/music/services/musicBank";
import type { MusicTrackId } from "@/features/music/types/music.types";

/** Plays one music track at a time and crossfades when the track changes. */
export interface MusicPlayer {
  /**
   * Switches to `track` (null = fade out). Asking for the playing track does nothing; another
   * track also ends a pause.
   */
  play(track: MusicTrackId | null, offsetSeconds?: number): void;
  /**
   * Holds the playing track at its position (a game pause) or continues it from there, so the
   * final piece still lands on the round end. Repeating the current state does nothing.
   */
  setPaused(paused: boolean): void;
  current(): MusicTrackId | null;
}

/** Seconds a pause fades the music out over: quick, so the menu feels like a stop, not a change. */
export const MUSIC_PAUSE_FADE_SECONDS = 0.15;

/** A track's buffer and where in it playback stands. */
interface Placement {
  buffer: AudioBuffer;
  loop: boolean;
  offsetSeconds: number;
}

interface Voice extends Placement {
  source: AudioBufferSourceNode;
  gain: GainNode;
  /** Context time the source started at `offsetSeconds`. */
  startedAt: number;
}

export interface MusicPlayerDeps {
  context: AudioContext;
  /** Where the tracks go (the duck node in front of the music bus). */
  output: AudioNode;
  load: (url: string) => Promise<AudioBuffer | null>;
}

function fadeOut(context: AudioContext, voice: Voice, seconds = MUSIC_FADE_SECONDS): void {
  const now = context.currentTime;
  voice.gain.gain.cancelScheduledValues(now);
  voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
  voice.gain.gain.linearRampToValueAtTime(0, now + seconds);
  voice.source.stop(now + seconds);
}

function startVoice({ context, output }: MusicPlayerDeps, placement: Placement): Voice {
  const { buffer, loop, offsetSeconds } = placement;
  const now = context.currentTime;
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = loop;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(1, now + MUSIC_FADE_SECONDS);
  source.connect(gain);
  gain.connect(output);
  const offset = loop
    ? offsetSeconds % buffer.duration
    : Math.min(offsetSeconds, Math.max(0, buffer.duration - 0.01));
  source.start(now, offset);
  return { ...placement, offsetSeconds: offset, source, gain, startedAt: now };
}

/** Where a voice stands now, to continue it later from the same spot. */
const placementNow = (context: AudioContext, voice: Voice): Placement => ({
  buffer: voice.buffer,
  loop: voice.loop,
  offsetSeconds: voice.offsetSeconds + (context.currentTime - voice.startedAt),
});

/** The music player on a shared context: loops lobby / match, plays the final piece once. */
export function createMusicPlayer(deps: MusicPlayerDeps): MusicPlayer {
  let current: MusicTrackId | null = null;
  let voice: Voice | null = null;
  /** Bumped per request, so a slow load never starts a track that was already replaced. */
  let request = 0;
  let paused = false;
  /** The paused track's spot; it continues from here on resume. */
  let held: Placement | null = null;

  /** Starts a loaded track, or keeps it for the resume while paused. */
  const begin = (placement: Placement): void => {
    if (paused) held = placement;
    else voice = startVoice(deps, placement);
  };

  return {
    play: (track, offsetSeconds = 0) => {
      if (track === current) return;
      current = track;
      request += 1;
      paused = false;
      held = null;
      if (voice) fadeOut(deps.context, voice);
      voice = null;
      if (track === null) return;
      const mine = request;
      const { url, loop } = MUSIC_TRACKS[track];
      const requestedAt = deps.context.currentTime;
      void deps.load(url).then((buffer) => {
        if (mine !== request || !buffer || deps.context.state === "closed") return;
        /** The final piece stays in time with the round clock even when its file loads late. */
        const late = deps.context.currentTime - requestedAt;
        begin({ buffer, loop, offsetSeconds: offsetSeconds + (loop ? 0 : late) });
      });
    },
    setPaused: (next) => {
      if (next === paused) return;
      paused = next;
      if (paused && voice) {
        held = placementNow(deps.context, voice);
        fadeOut(deps.context, voice, MUSIC_PAUSE_FADE_SECONDS);
        voice = null;
      } else if (!paused && held) {
        voice = startVoice(deps, held);
        held = null;
      }
    },
    current: () => current,
  };
}
