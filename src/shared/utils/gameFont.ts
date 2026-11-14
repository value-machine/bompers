/**
 * The game's typeface (DESIGN_LANGUAGE § 7): Fredoka from the Google Fonts link in `index.html`.
 * Pixi `Text` rasterises with whatever face the browser has at creation time, so the session
 * waits for the font before creating any text (visual-pass D5); after `timeoutMs` it starts
 * anyway and the stack falls back to a rounded system face.
 */
export const GAME_FONT_FAMILY =
  "Fredoka, ui-rounded, 'Arial Rounded MT Bold', system-ui, sans-serif";

const FONT_PROBE = "700 20px Fredoka";

interface FontLoader {
  load: (font: string) => Promise<unknown>;
}

/** Resolves true once Fredoka is ready, false on timeout, error or no font API. */
export function waitForGameFont(
  timeoutMs: number,
  fonts: FontLoader | null = typeof document === "undefined" ? null : document.fonts
): Promise<boolean> {
  if (!fonts) return Promise.resolve(false);
  const loaded = fonts.load(FONT_PROBE).then(
    (faces) => Array.isArray(faces) && faces.length > 0,
    () => false
  );
  const timeout = new Promise<boolean>((resolve) => {
    setTimeout(() => resolve(false), timeoutMs);
  });
  return Promise.race([loaded, timeout]);
}
