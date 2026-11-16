/**
 * The OS "reduce motion" setting (DESIGN_LANGUAGE § 6: no screen shake, gentler flash). Reads one
 * cached media query, so calling it every frame is cheap; false outside a browser.
 */
let query: MediaQueryList | null | undefined;

export function prefersReducedMotion(): boolean {
  if (query === undefined) {
    query =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
  }
  return query?.matches ?? false;
}
