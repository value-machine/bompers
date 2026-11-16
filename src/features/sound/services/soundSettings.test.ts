import { describe, expect, it } from "vitest";
import {
  busGains,
  DEFAULT_SOUND_SETTINGS,
  parseSoundSettings,
  stepVolume,
  withChannelEnabled,
  withVolumeStep,
} from "@/features/sound/services/soundSettings";

describe("soundSettings", () => {
  it("should step volume in tenths and clamp at the ends when stepping", () => {
    expect(stepVolume(0.5, 1)).toBe(0.6);
    expect(stepVolume(0.5, -1)).toBe(0.4);
    expect(stepVolume(1, 1)).toBe(1);
    expect(stepVolume(0, -1)).toBe(0);
  });

  it("should wrap from full volume to zero when wrap is asked", () => {
    expect(stepVolume(1, 1, true)).toBe(0);
    expect(stepVolume(0.9, 1, true)).toBe(1);
  });

  it("should change only the named channel when stepping a volume", () => {
    const next = withVolumeStep(DEFAULT_SOUND_SETTINGS, { channel: "music", step: -1 });
    expect(next.musicVolume).toBe(DEFAULT_SOUND_SETTINGS.musicVolume - 0.1);
    expect(next.sfxVolume).toBe(DEFAULT_SOUND_SETTINGS.sfxVolume);
  });

  it("should silence a bus but keep its volume when the channel is disabled", () => {
    const off = withChannelEnabled(DEFAULT_SOUND_SETTINGS, "music", false);
    expect(busGains(off)).toEqual({ sfx: DEFAULT_SOUND_SETTINGS.sfxVolume, music: 0 });
    expect(off.musicVolume).toBe(DEFAULT_SOUND_SETTINGS.musicVolume);
  });

  it("should round-trip stored settings when the entry is valid", () => {
    const stored = { sfxVolume: 0.3, musicVolume: 1, sfxEnabled: false, musicEnabled: true };
    expect(parseSoundSettings(JSON.stringify(stored))).toEqual(stored);
  });

  it("should fall back to defaults when the stored entry is missing or malformed", () => {
    expect(parseSoundSettings(null)).toEqual(DEFAULT_SOUND_SETTINGS);
    expect(parseSoundSettings("{not json")).toEqual(DEFAULT_SOUND_SETTINGS);
    expect(parseSoundSettings(JSON.stringify({ sfxVolume: 7, musicEnabled: "yes" }))).toEqual(
      DEFAULT_SOUND_SETTINGS
    );
  });
});
