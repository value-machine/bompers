import type { SoundChannel, SoundSettings } from "@/features/sound/types/sound.types";

const STORAGE_KEY = "bompers.sound.settings";

/** Number of volume steps (the lobby shows 0–10). */
export const VOLUME_STEPS = 10;

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  sfxVolume: 1,
  musicVolume: 0.6,
  sfxEnabled: true,
  musicEnabled: true,
};

const VOLUME_KEY: Record<SoundChannel, "sfxVolume" | "musicVolume"> = {
  sfx: "sfxVolume",
  music: "musicVolume",
};

const ENABLED_KEY: Record<SoundChannel, "sfxEnabled" | "musicEnabled"> = {
  sfx: "sfxEnabled",
  music: "musicEnabled",
};

export const volumeOf = (settings: SoundSettings, channel: SoundChannel): number =>
  settings[VOLUME_KEY[channel]];

export const isChannelEnabled = (settings: SoundSettings, channel: SoundChannel): boolean =>
  settings[ENABLED_KEY[channel]];

const clampVolume = (value: number): number =>
  Math.round(Math.min(1, Math.max(0, value)) * VOLUME_STEPS) / VOLUME_STEPS;

/** One step up or down; `wrap` goes from full back to 0 (confirm on a menu row). */
export function stepVolume(volume: number, step: 1 | -1, wrap = false): number {
  const next = Math.round(volume * VOLUME_STEPS) + step;
  if (wrap && next > VOLUME_STEPS) return 0;
  return clampVolume(next / VOLUME_STEPS);
}

/** The settings with one channel's volume stepped. */
export const withVolumeStep = (
  settings: SoundSettings,
  { channel, step, wrap }: { channel: SoundChannel; step: 1 | -1; wrap?: boolean }
): SoundSettings => ({
  ...settings,
  [VOLUME_KEY[channel]]: stepVolume(volumeOf(settings, channel), step, wrap),
});

/** The settings with one channel switched on or off. */
export const withChannelEnabled = (
  settings: SoundSettings,
  channel: SoundChannel,
  enabled: boolean
): SoundSettings => ({ ...settings, [ENABLED_KEY[channel]]: enabled });

/** Gain of each bus: its volume when enabled, else 0. Mute (M) silences the master instead. */
export const busGains = (settings: SoundSettings): Record<SoundChannel, number> => ({
  sfx: settings.sfxEnabled ? settings.sfxVolume : 0,
  music: settings.musicEnabled ? settings.musicVolume : 0,
});

const pick = <T>(value: unknown, fallback: T, valid: (raw: unknown) => boolean): T =>
  valid(value) ? (value as T) : fallback;

const isVolume = (raw: unknown): boolean => typeof raw === "number" && raw >= 0 && raw <= 1;
const isFlag = (raw: unknown): boolean => typeof raw === "boolean";

/** Reads stored settings; anything missing or malformed falls back to the default. */
export function parseSoundSettings(raw: string | null): SoundSettings {
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object") data = parsed as Record<string, unknown>;
  } catch {
    // Corrupt entry: defaults.
  }
  const d = DEFAULT_SOUND_SETTINGS;
  return {
    sfxVolume: clampVolume(pick(data.sfxVolume, d.sfxVolume, isVolume)),
    musicVolume: clampVolume(pick(data.musicVolume, d.musicVolume, isVolume)),
    sfxEnabled: pick(data.sfxEnabled, d.sfxEnabled, isFlag),
    musicEnabled: pick(data.musicEnabled, d.musicEnabled, isFlag),
  };
}

export function readSoundSettings(storage: Storage | undefined): SoundSettings {
  try {
    return parseSoundSettings(storage?.getItem(STORAGE_KEY) ?? null);
  } catch {
    return DEFAULT_SOUND_SETTINGS;
  }
}

export function writeSoundSettings(storage: Storage | undefined, settings: SoundSettings): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage blocked (private mode): settings still apply for this session.
  }
}
