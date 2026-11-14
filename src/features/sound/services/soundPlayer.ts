import {
  DUCKING_SOUNDS,
  SOUND_FILES,
  SOUND_MIX,
  pickTakeIndex,
  playbackRateFor,
} from "@/features/sound/services/soundBank";
import type { SoundCue } from "@/features/sound/types/sound.types";

/** Key that toggles mute in game (not used by any keyboard layout). */
export const MUTE_KEY_CODE = "KeyM";
const MUTE_STORAGE_KEY = "bompers.sound.muted";

/** The game's sound output: plays cues, toggles mute (M), and is disposed with the session. */
export interface SoundPlayer {
  play(cue: SoundCue): void;
  toggleMute(): void;
  isMuted(): boolean;
  dispose(): void;
}

/** What the player needs from the browser (a real `window`, or a stub in tests). */
export interface SoundHost {
  addEventListener: Window["addEventListener"];
  removeEventListener: Window["removeEventListener"];
  AudioContext?: typeof AudioContext;
  fetch: typeof fetch;
  localStorage?: Storage;
}

const readMuted = (host: SoundHost): boolean => {
  try {
    return host.localStorage?.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

const writeMuted = (host: SoundHost, muted: boolean): void => {
  try {
    host.localStorage?.setItem(MUTE_STORAGE_KEY, muted ? "1" : "0");
  } catch {
    // Storage blocked (private mode): mute still works for this session.
  }
};

const decibelsToGain = (db: number): number => 10 ** (db / 20);

/** A player that does nothing (no Web Audio in this browser or test). */
const silentPlayer = (): SoundPlayer => {
  let muted = false;
  return {
    play: () => undefined,
    toggleMute: () => {
      muted = !muted;
    },
    isMuted: () => muted,
    dispose: () => undefined,
  };
};

interface Mixer {
  master: GainNode;
  sfxBus: GainNode;
  musicBus: GainNode;
}

/** master → destination, with an SFX bus and a music bus (the bus explosions duck). */
function createMixer(context: AudioContext): Mixer {
  const master = context.createGain();
  const sfxBus = context.createGain();
  const musicBus = context.createGain();
  sfxBus.connect(master);
  musicBus.connect(master);
  master.connect(context.destination);
  return { master, sfxBus, musicBus };
}

/** Fetches and decodes each URL once; a failed file warns and plays nothing. */
function createBufferLoader(
  host: SoundHost,
  context: AudioContext
): (url: string) => Promise<AudioBuffer | null> {
  const buffers = new Map<string, Promise<AudioBuffer | null>>();
  return (url) => {
    const cached = buffers.get(url);
    if (cached) return cached;
    const pending = host
      .fetch(url)
      .then((response) => response.arrayBuffer())
      .then((data) => context.decodeAudioData(data))
      .catch((error: unknown) => {
        console.warn(`Sound file failed to load: ${url}`, error);
        return null;
      });
    buffers.set(url, pending);
    return pending;
  };
}

function duckMusic(context: AudioContext, musicBus: GainNode): void {
  const now = context.currentTime;
  musicBus.gain.cancelScheduledValues(now);
  musicBus.gain.setValueAtTime(decibelsToGain(-SOUND_MIX.duckDecibels), now);
  musicBus.gain.linearRampToValueAtTime(1, now + SOUND_MIX.duckSeconds);
}

/** One voice: the buffer at the cue's pitch and gain, into the SFX bus. */
function startVoice(
  { context, mixer }: { context: AudioContext; mixer: Mixer },
  buffer: AudioBuffer,
  cue: SoundCue
): void {
  if (context.state === "closed") return;
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = playbackRateFor(cue.slot);
  const voice = context.createGain();
  voice.gain.value = cue.gain;
  source.connect(voice);
  voice.connect(mixer.sfxBus);
  source.start();
}

/** Picks the take for a cue (random, no immediate repeat), or null to skip a too-fast retrigger. */
function createTakePicker(context: AudioContext): (cue: SoundCue) => string | null {
  const lastTake = new Map<string, number>();
  const lastPlayed = new Map<string, number>();
  return (cue) => {
    const urls = SOUND_FILES[cue.soundId] ?? [];
    const now = context.currentTime;
    const tooSoon =
      now - (lastPlayed.get(cue.soundId) ?? -Infinity) < SOUND_MIX.minRetriggerSeconds;
    if (urls.length === 0 || tooSoon) return null;
    lastPlayed.set(cue.soundId, now);
    const take = pickTakeIndex(urls.length, lastTake.get(cue.soundId) ?? null, Math.random);
    lastTake.set(cue.soundId, take);
    return urls[take] ?? null;
  };
}

/** Resumes the context on the first press (browsers start it suspended) and maps M to mute. */
function bindKeys(host: SoundHost, context: AudioContext, toggleMute: () => void): () => void {
  const resume = (): void => {
    if (context.state === "suspended") void context.resume();
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    resume();
    if (event.code === MUTE_KEY_CODE && !event.repeat) toggleMute();
  };
  host.addEventListener("keydown", onKeyDown);
  host.addEventListener("pointerdown", resume);
  return () => {
    host.removeEventListener("keydown", onKeyDown);
    host.removeEventListener("pointerdown", resume);
  };
}

/**
 * Creates the Web Audio sound player (DESIGN_LANGUAGE § 8): per-player pitch, random take
 * rotation, explosion ducking of the music bus, master volume and an M mute toggle that the
 * browser remembers. Takes are fetched and decoded once, warmed at creation.
 */
export function createSoundPlayer(host: SoundHost): SoundPlayer {
  if (!host.AudioContext) return silentPlayer();
  const context = new host.AudioContext();
  const mixer = createMixer(context);
  const load = createBufferLoader(host, context);
  const pickTake = createTakePicker(context);
  let muted = readMuted(host);
  mixer.master.gain.value = muted ? 0 : SOUND_MIX.masterGain;
  Object.values(SOUND_FILES).forEach((urls) => urls.forEach((url) => void load(url)));

  const toggleMute = (): void => {
    muted = !muted;
    writeMuted(host, muted);
    mixer.master.gain.setValueAtTime(muted ? 0 : SOUND_MIX.masterGain, context.currentTime);
  };
  const unbindKeys = bindKeys(host, context, toggleMute);

  return {
    play: (cue) => {
      const url = pickTake(cue);
      if (url === null) return;
      if (DUCKING_SOUNDS.has(cue.soundId)) duckMusic(context, mixer.musicBus);
      void load(url).then((buffer) => buffer && startVoice({ context, mixer }, buffer, cue));
    },
    toggleMute,
    isMuted: () => muted,
    dispose: () => {
      unbindKeys();
      void context.close();
    },
  };
}
