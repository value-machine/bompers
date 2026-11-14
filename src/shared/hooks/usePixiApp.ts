import { useEffect, useState, type RefObject } from "react";
import { Application } from "pixi.js";

export interface UsePixiAppOptions {
  /** Canvas clear color (0xRRGGBB). */
  background: number;
}

/**
 * Mounts one PixiJS `Application` into `hostRef` and resizes it with the host element.
 *
 * StrictMode-safe: React mounts, unmounts and remounts in development, while `app.init()` is
 * async. A per-effect `cancelled` flag destroys an app whose init finishes after cleanup, and
 * cleanup destroys an initialized app (renderer, canvas and the whole stage tree). Returns
 * `null` until the app is ready.
 */
export function usePixiApp(
  hostRef: RefObject<HTMLElement | null>,
  options: UsePixiAppOptions
): Application | null {
  const [app, setApp] = useState<Application | null>(null);
  const { background } = options;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let cancelled = false;
    let ready: Application | null = null;
    const instance = new Application();

    void instance
      .init({
        background,
        resizeTo: host,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio,
      })
      .then(() => {
        if (cancelled) {
          instance.destroy({ removeView: true }, { children: true });
          return;
        }
        ready = instance;
        host.appendChild(instance.canvas);
        setApp(instance);
      });

    return () => {
      cancelled = true;
      setApp(null);
      ready?.destroy({ removeView: true }, { children: true });
    };
  }, [hostRef, background]);

  return app;
}
