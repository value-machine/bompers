import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { parseLevelFile } from "@/features/level-file/services/levelFileParser";
import {
  BUILT_IN_LEVEL_URL,
  loadLevelFromUrl,
} from "@/features/level-file/services/levelFileSource";
import type { LevelIssue } from "@/features/level-file/types/levelFile.types";

/** Outcome of the last import, shown to the player (and the AI agent's human). */
export interface LevelImportReport {
  fileName: string;
  ok: boolean;
  errors: LevelIssue[];
  warnings: LevelIssue[];
}

export interface LevelSource {
  /** The level to play: the last imported one, else the built-in; null while loading. */
  level: LevelDefinition | null;
  /** Built-in level failed to load (the game has nothing to play). */
  loadError: string | null;
  report: LevelImportReport | null;
  importFile: (file: File) => Promise<void>;
  dismissReport: () => void;
}

/**
 * The level the game plays: the built-in level file, replaced by each valid imported file.
 * A rejected file keeps the current level and reports its errors; every import (even of the
 * same file) yields a new level object, which restarts the match.
 */
export function useLevelSource(): LevelSource {
  const builtIn = useQuery({
    queryKey: ["level-file", BUILT_IN_LEVEL_URL],
    queryFn: () => loadLevelFromUrl(BUILT_IN_LEVEL_URL),
    staleTime: Infinity,
  });
  const [imported, setImported] = useState<LevelDefinition | null>(null);
  const [report, setReport] = useState<LevelImportReport | null>(null);

  const importFile = useCallback(async (file: File): Promise<void> => {
    const result = parseLevelFile(await file.text());
    if (result.ok) setImported(result.level);
    setReport({
      fileName: file.name,
      ok: result.ok,
      errors: result.ok ? [] : result.errors,
      warnings: result.warnings,
    });
  }, []);

  const dismissReport = useCallback(() => setReport(null), []);

  return {
    level: imported ?? builtIn.data?.level ?? null,
    loadError: builtIn.error ? builtIn.error.message : null,
    report,
    importFile,
    dismissReport,
  };
}
