import { GAME_PALETTE } from "@/shared/config/gamePalette";

/**
 * Debug ink (fire-black-flash diagnosis): with `?debugInk=1` in the page URL, every world ink or
 * dark pass is drawn in its own bright colour instead of ink, and the game shows a legend, so a
 * black shape that flashes on screen names the layer it comes from. Off by default: then every
 * call returns the normal colour, and nothing else changes. Read once per page load.
 */
export type InkLayer =
  | "terrainOutline"
  | "moverOutline"
  | "fireBody"
  | "fireFlames"
  | "fireSprays"
  | "fireScorch"
  | "ice"
  | "stains"
  | "blobs"
  | "other";

export const DEBUG_INK_LAYERS: Readonly<Record<InkLayer, { color: number; label: string }>> = {
  terrainOutline: { color: 0xff00ff, label: "Terrain outline" },
  moverOutline: { color: 0xff77bb, label: "Moving-part outline" },
  fireBody: { color: 0x00ff00, label: "Fire body ink" },
  fireFlames: { color: 0x00ffff, label: "Fire flame ink" },
  fireSprays: { color: 0x0066ff, label: "Torch, puff and smoke ink" },
  fireScorch: { color: 0xffff00, label: "Scorch" },
  ice: { color: 0xff0000, label: "Ice ink" },
  stains: { color: 0x8800ff, label: "Goo stains" },
  blobs: { color: 0xff8800, label: "Blob, helmet and tube ink" },
  other: { color: 0x888888, label: "Other ink (effects, shadows, pickups)" },
};

function readFlag(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("debugInk") === "1"
    );
  } catch {
    return false;
  }
}

/** Whether this page load draws ink in debug colours. */
export const DEBUG_INK_ON: boolean = readFlag();

/** The colour of one ink pass: its debug colour with the flag on, else `normal` (ink). */
export function inkColor(layer: InkLayer, normal: number = GAME_PALETTE.ink): number {
  return DEBUG_INK_ON ? DEBUG_INK_LAYERS[layer].color : normal;
}
