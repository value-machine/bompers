import {
  DUCKING_SOUNDS,
  SOUND_FILES,
  SOUND_MIX,
  pickTakeIndex,
  playbackRateFor,
} from "@/features/sound/services/soundBank";
import { MUSIC_TRACKS } from "@/features/sound/services/musicBank";
import { createMusicPlayer, type MusicPlayer } from "@/features/sound/services/musicPlayer";
import {
  busGains,
  readSoundSettings,
  writeSoundSettings,
} from "@/features/sound/services/soundSettings";
import type {
  MusicTrackId,
  SoundCue,
  SoundLoop,
  SoundSettings,
} from "@/features/sound/types/sound.types";

/** Key that toggles mute in game (not used by any keyboard layout). */
export const MUTE_KEY_CODE = "KeyM";
const MUTE_STORAGE_KEY = "bompers.sound.muted";

/**
 * The game's audio output for the whole app lifetime: SFX cues, music, the player's sound
 * settings (volumes, on/off per channel) and the M mute. One per page; never per match, so
 * music carries from lobby to match and explosions duck it.
 */
export interface AudioEngine {
  playCue(cue: SoundCue): void;
  /**
   * The held loops wanted this frame: new ones fade in, gone ones fade out, gains follow. Call it
   * every frame; a loop not refreshed for `SOUND_MIX.loopHoldSeconds` fades out by itself (a
   * paused or closed match goes quiet without telling the engine).
   */
  setLoops(loops: readonly SoundLoop[]): void;
  /** Switches the music (null = fade out); asking for the playing track does nothing. */
  playMusic(track: MusicTrackId | null, offsetSeconds?: number): void;
  /** Holds the music at its position (game paused) or continues it; a new track ends the hold. */
  setMusicPaused(paused: boolean): void;
  settings(): SoundSettings;
  updateSettings(change: (settings: SoundSettings) => SoundSettings): void;
  /** Called after every settings or mute change; returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
  toggleMute(): void;
  /** The M mute, remembered by the browser; subscribers hear every change (the sound-status chip shows it). */
  isMuted(): boolean;
  dispose(): void;
}

/** What the engine needs from the browser (a real `window`, or a stub in tests). */
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

interface SettingsStore {
  get(): SoundSettings;
  update(change: (settings: SoundSettings) => SoundSettings): void;
  isMuted(): boolean;
  toggleMute(): void;
  subscribe(listener: () => void): () => void;
}

/** The settings and the M mute, remembered by the browser, with change listeners. */
function createSettingsStore(host: SoundHost): SettingsStore {
  let settings = readSoundSettings(host.localStorage);
  let muted = readMuted(host);
  const listeners = new Set<() => void>();
  const notify = (): void => listeners.forEach((listener) => listener());
  return {
    get: () => settings,
    update: (change) => {
      settings = change(settings);
      writeSoundSettings(host.localStorage, settings);
      notify();
    },
    isMuted: () => muted,
    toggleMute: () => {
      muted = !muted;
      writeMuted(host, muted);
      notify();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** An engine that plays nothing (no Web Audio in this browser or test); settings and mute still work. */
function silentEngine(host: SoundHost): AudioEngine {
  const store = createSettingsStore(host);
  return {
    playCue: () => undefined,
    setLoops: () => undefined,
    playMusic: () => undefined,
    setMusicPaused: () => undefined,
    settings: store.get,
    updateSettings: store.update,
    subscribe: store.subscribe,
    toggleMute: store.toggleMute,
    isMuted: store.isMuted,
    dispose: () => undefined,
  };
}

interface Mixer {
  master: GainNode;
  sfxBus: GainNode;
  /** Music volume. */
  musicBus: GainNode;
  /** In front of the music bus: explosions duck this one, so ducking never fights the volume. */
  musicDuck: GainNode;
}

/** master → destination; SFX bus and music bus (← duck) into the master. */
function createMixer(context: AudioContext): Mixer {
  const master = context.createGain();
  const sfxBus = context.createGain();
  const musicBus = context.createGain();
  const musicDuck = context.createGain();
  sfxBus.connect(master);
  musicDuck.connect(musicBus);
  musicBus.connect(master);
  master.connect(context.destination);
  return { master, sfxBus, musicBus, musicDuck };
}

function applyGains(
  context: AudioContext,
  mixer: Mixer,
  { settings, muted }: { settings: SoundSettings; muted: boolean }
): void {
  const now = context.currentTime;
  const gains = busGains(settings);
  mixer.master.gain.setValueAtTime(muted ? 0 : SOUND_MIX.masterGain, now);
  mixer.sfxBus.gain.setValueAtTime(gains.sfx, now);
  mixer.musicBus.gain.setValueAtTime(gains.music, now);
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
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.arrayBuffer();
      })
      .then((data) => context.decodeAudioData(data))
      .catch((error: unknown) => {
        console.warn(`Sound file failed to load: ${url}`, error);
        return null;
      });
    buffers.set(url, pending);
    return pending;
  };
}

function duckMusic(context: AudioContext, musicDuck: GainNode): void {
  const now = context.currentTime;
  musicDuck.gain.cancelScheduledValues(now);
  musicDuck.gain.setValueAtTime(decibelsToGain(-SOUND_MIX.duckDecibels), now);
  musicDuck.gain.linearRampToValueAtTime(1, now + SOUND_MIX.duckSeconds);
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

interface LoopVoice {
  soundId: string;
  rate: number;
  /** Null while the file is still loading. */
  buffer: AudioBuffer | null;
  /** The voice's level: fades in and out and holds while refreshed. */
  gain: GainNode;
  /** When the next pass of the file has to start (context seconds). */
  nextAt: number;
}

/** Equal-power fade curves for the overlap between two passes of a loop. */
const CURVE_POINTS = 32;
const FADE_IN_CURVE = Float32Array.from({ length: CURVE_POINTS }, (_, i) =>
  Math.sin(((i / (CURVE_POINTS - 1)) * Math.PI) / 2)
);
const FADE_OUT_CURVE = Float32Array.from({ length: CURVE_POINTS }, (_, i) =>
  Math.cos(((i / (CURVE_POINTS - 1)) * Math.PI) / 2)
);

/**
 * One pass of a loop's file, starting at `at`: it fades in over the overlap (unless it is the
 * first) and fades out over its last overlap while the next pass fades in, so a pass never
 * restarts hard and the mp3's silent edges never reach the ear.
 */
function schedulePass(
  context: AudioContext,
  voice: LoopVoice,
  { buffer, first }: { buffer: AudioBuffer; first: boolean }
): void {
  const overlap = SOUND_MIX.loopCrossfadeSeconds;
  const seconds = buffer.duration / voice.rate;
  const at = voice.nextAt;
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = voice.rate;
  const pass = context.createGain();
  if (!first) pass.gain.setValueCurveAtTime(FADE_IN_CURVE, at, overlap);
  pass.gain.setValueCurveAtTime(FADE_OUT_CURVE, at + seconds - overlap, overlap);
  source.connect(pass);
  pass.connect(voice.gain);
  source.onended = () => pass.disconnect();
  source.start(at);
  source.stop(at + seconds);
  voice.nextAt = at + seconds - overlap;
}

/**
 * Keeps the frame's loops sounding (one voice per loop key). A voice plays its file as passes
 * that crossfade into each other, scheduled a little ahead on each refresh. Each refresh also
 * holds the voice's level for `loopHoldSeconds` and schedules its fade after that, so a voice
 * nobody refreshes goes quiet by itself (and its last passes end), and picks up again if
 * refreshed later.
 */
function createLoopVoices(
  { context, mixer }: { context: AudioContext; mixer: Mixer },
  load: (url: string) => Promise<AudioBuffer | null>
): (loops: readonly SoundLoop[]) => void {
  const voices = new Map<string, LoopVoice>();
  const { loopFadeSeconds: fade, loopHoldSeconds: hold } = SOUND_MIX;

  const level = (voice: LoopVoice, target: number, holdFor: number): void => {
    const now = context.currentTime;
    const gain = voice.gain.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(target, now + fade);
    if (holdFor > fade) gain.setValueAtTime(target, now + holdFor);
    gain.linearRampToValueAtTime(0, now + Math.max(holdFor, fade) + fade);
  };

  const refresh = (voice: LoopVoice, target: number): void => {
    const { buffer } = voice;
    if (!buffer) return;
    const ahead = context.currentTime + hold + fade;
    const first = voice.nextAt === 0;
    if (voice.nextAt < context.currentTime) voice.nextAt = context.currentTime;
    for (let n = 0; voice.nextAt < ahead; n += 1) {
      schedulePass(context, voice, { buffer, first: first && n === 0 });
    }
    level(voice, target, hold);
  };

  const start = (key: string, loop: SoundLoop): void => {
    const url = SOUND_FILES[loop.soundId]?.[0];
    if (!url || context.state === "closed") return;
    const gain = context.createGain();
    gain.gain.value = 0;
    gain.connect(mixer.sfxBus);
    const rate = playbackRateFor(loop.slot);
    const voice: LoopVoice = { soundId: loop.soundId, rate, buffer: null, gain, nextAt: 0 };
    voices.set(key, voice);
    void load(url).then((buffer) => {
      if (!buffer || voices.get(key) !== voice || context.state === "closed") return;
      voice.buffer = buffer;
      refresh(voice, loop.gain);
    });
  };

  return (loops) => {
    const wanted = new Set<string>();
    for (const loop of loops) {
      wanted.add(loop.key);
      const voice = voices.get(loop.key);
      if (!voice || voice.soundId !== loop.soundId) start(loop.key, loop);
      else refresh(voice, loop.gain);
    }
    for (const [key, voice] of voices) {
      if (wanted.has(key)) continue;
      level(voice, 0, 0);
      voices.delete(key);
    }
  };
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

/** Fetches every SFX take and music track once, so the first play is not late. */
function warm(load: (url: string) => Promise<AudioBuffer | null>): void {
  Object.values(SOUND_FILES).forEach((urls) => urls.forEach((url) => void load(url)));
  Object.values(MUSIC_TRACKS).forEach((track) => void load(track.url));
}

/**
 * Creates the Web Audio engine (DESIGN_LANGUAGE § 8): per-player pitch, random take rotation,
 * music with crossfades, explosion ducking of the music, SFX and music volumes with on/off
 * switches, and an M mute; settings and mute are remembered by the browser.
 */
export function createAudioEngine(host: SoundHost): AudioEngine {
  if (!host.AudioContext) return silentEngine(host);
  const context = new host.AudioContext();
  const mixer = createMixer(context);
  const load = createBufferLoader(host, context);
  const pickTake = createTakePicker(context);
  const music: MusicPlayer = createMusicPlayer({ context, output: mixer.musicDuck, load });
  const store = createSettingsStore(host);
  const apply = (): void =>
    applyGains(context, mixer, { settings: store.get(), muted: store.isMuted() });
  apply();
  const unsubscribeGains = store.subscribe(apply);
  warm(load);

  const unbindKeys = bindKeys(host, context, store.toggleMute);

  return {
    playCue: (cue) => {
      const url = pickTake(cue);
      if (url === null) return;
      if (DUCKING_SOUNDS.has(cue.soundId)) duckMusic(context, mixer.musicDuck);
      void load(url).then((buffer) => buffer && startVoice({ context, mixer }, buffer, cue));
    },
    setLoops: createLoopVoices({ context, mixer }, load),
    playMusic: music.play,
    setMusicPaused: music.setPaused,
    settings: store.get,
    updateSettings: store.update,
    subscribe: store.subscribe,
    toggleMute: store.toggleMute,
    isMuted: store.isMuted,
    dispose: () => {
      unsubscribeGains();
      unbindKeys();
      void context.close();
    },
  };
}
