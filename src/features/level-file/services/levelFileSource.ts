import type { LevelDefinition } from "@/features/level/api/levelApi";
import { parseLevelFile } from "@/features/level-file/services/levelFileParser";
import type { LevelIssue } from "@/features/level-file/types/levelFile.types";

/**
 * Where level file text comes from: a built-in level served from `public/levels/` (real level
 * files, the same format players import), or a file the player picks or drops.
 */
/**
 * The built-in level manifest: every file in `public/levels/`, in picker order. The first is
 * the default (the GDD § 4 start map). A drift test checks it against the folder, so a new
 * level file is one file plus one line here.
 */
export const BUILT_IN_LEVEL_FILES = [
  "start-arena.html",
  "floating-garden.html",
  "bobsled-run.html",
  "piston-works.html",
  "bonfire-bridge.html",
  "crystal-gap.html",
  "slush-bowl.html",
  "tree-grove.html",
  "beach-court.html",
  "ball-playground.html",
] as const;

/** Served URL of a built-in level file. */
export const builtInLevelUrl = (fileName: string): string => `/levels/${fileName}`;

export const BUILT_IN_LEVEL_URLS: readonly string[] = BUILT_IN_LEVEL_FILES.map(builtInLevelUrl);

export interface LoadedLevel {
  level: LevelDefinition;
  warnings: LevelIssue[];
}

/** Fetches and parses a served level file; rejects with a readable message. */
export async function loadLevelFromUrl(url: string): Promise<LoadedLevel> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load level ${url} (HTTP ${response.status}).`);
  const result = parseLevelFile(await response.text());
  if (!result.ok) {
    throw new Error(`Level ${url} is invalid: ${result.errors.map((e) => e.message).join(" ")}`);
  }
  return { level: result.level, warnings: result.warnings };
}
