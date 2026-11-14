import type { LevelDefinition } from "@/features/level/api/levelApi";
import { parseLevelFile } from "@/features/level-file/services/levelFileParser";
import type { LevelIssue } from "@/features/level-file/types/levelFile.types";

/**
 * Where level file text comes from: a built-in level served from `public/levels/` (real level
 * files, the same format players import), or a file the player picks or drops.
 */
export const BUILT_IN_LEVEL_URL = "/levels/start-arena.html";

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
