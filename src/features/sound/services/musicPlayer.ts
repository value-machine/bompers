import { MUSIC_FADE_SECONDS, MUSIC_TRACKS } from "@/features/sound/services/musicBank";
import type { MusicTrackId } from "@/features/sound/types/sound.types";

/** Plays one music track at a time and crossfades when the track changes. */
export interface MusicPlayer {
  /** Switches to `track` (null = fade out). Asking for the playing track does nothing. */
  play(track: MusicTrackId | null, offsetSeconds?: number): void;
  current(): MusicTrackId | null;
}

interface Voice {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export interface MusicPlayerDeps {
  context: AudioContext;
  /** Where the tracks go (the duck node in front of the music bus). */
  output: AudioNode;
  load: (url: string) => Promise<AudioBuffer | null>;
}

function fadeOut(context: AudioContext, voice: Voice): void {
  const now = context.currentTime;
  voice.gain.gain.cancelScheduledValues(now);
  voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
  voice.gain.gain.linearRampToValueAtTime(0, now + MUSIC_FADE_SECONDS);
  voice.source.stop(now + MUSIC_FADE_SECONDS);
}

function startVoice(
  { context, output }: MusicPlayerDeps,
  buffer: AudioBuffer,
  { loop, offsetSeconds }: { loop: boolean; offsetSeconds: number }
): Voice {
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
  return { source, gain };
}

/** The music player on a shared context: loops lobby / match, plays the final piece once. */
export function createMusicPlayer(deps: MusicPlayerDeps): MusicPlayer {
  let current: MusicTrackId | null = null;
  let voice: Voice | null = null;
  /** Bumped per request, so a slow load never starts a track that was already replaced. */
  let request = 0;

  return {
    play: (track, offsetSeconds = 0) => {
      if (track === current) return;
      current = track;
      request += 1;
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
        voice = startVoice(deps, buffer, {
          loop,
          offsetSeconds: offsetSeconds + (loop ? 0 : late),
        });
      });
    },
    current: () => current,
  };
}
