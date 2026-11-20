import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FINAL_MUSIC_SECONDS,
  MUSIC_BASE_URL,
  MUSIC_TRACKS,
  musicTrackFor,
} from "@/features/music/services/musicBank";

describe("musicBank", () => {
  it("should play the match loop when more than the final stretch is left", () => {
    expect(musicTrackFor({ phase: "playing", remainingSeconds: 90 })).toBe("match");
    expect(musicTrackFor({ phase: "playing", remainingSeconds: FINAL_MUSIC_SECONDS + 0.01 })).toBe(
      "match"
    );
  });

  it("should switch to the final piece when 30 seconds or less are left", () => {
    expect(musicTrackFor({ phase: "playing", remainingSeconds: FINAL_MUSIC_SECONDS })).toBe(
      "final"
    );
    expect(musicTrackFor({ phase: "playing", remainingSeconds: 2 })).toBe("final");
  });

  it("should play no music when the round has ended", () => {
    expect(musicTrackFor({ phase: "ended", remainingSeconds: 0 })).toBeNull();
  });

  it("should loop the lobby and match tracks but not the final piece when listing tracks", () => {
    expect(MUSIC_TRACKS.lobby.loop).toBe(true);
    expect(MUSIC_TRACKS.match.loop).toBe(true);
    expect(MUSIC_TRACKS.final.loop).toBe(false);
    for (const track of Object.values(MUSIC_TRACKS)) {
      expect(track.url.startsWith(MUSIC_BASE_URL)).toBe(true);
    }
  });

  it("should point at files that exist in public/audio/music when listing tracks", () => {
    for (const track of Object.values(MUSIC_TRACKS)) {
      const file = resolve(process.cwd(), "public", track.url.slice(1));
      expect(existsSync(file), track.url).toBe(true);
    }
  });
});
