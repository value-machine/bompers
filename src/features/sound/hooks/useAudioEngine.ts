import { useEffect, useState, useSyncExternalStore } from "react";
import { createAudioEngine, type AudioEngine } from "@/features/sound/services/audioEngine";
import type { MusicTrackId } from "@/features/music/api/musicApi";
import type { SoundSettings } from "@/features/sound/types/sound.types";

/** One engine for the app lifetime: browsers allow few AudioContexts, and music must not restart. */
let sharedEngine: AudioEngine | null = null;

const getSharedEngine = (): AudioEngine => {
  sharedEngine ??= createAudioEngine(window);
  return sharedEngine;
};

/** The app's audio engine (shared by every screen; never disposed). */
export function useAudioEngine(): AudioEngine {
  const [engine] = useState(getSharedEngine);
  return engine;
}

/** Plays `track` while the calling component is mounted; fades the music out on unmount. */
export function useMusicTrack(track: MusicTrackId): void {
  const engine = useAudioEngine();
  useEffect(() => {
    engine.playMusic(track);
    return () => engine.playMusic(null);
  }, [engine, track]);
}

/** The engine's sound settings, re-rendering on every change. */
export function useSoundSettings(engine: AudioEngine): SoundSettings {
  return useSyncExternalStore(engine.subscribe, engine.settings);
}
