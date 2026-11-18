import { useCallback, useMemo, useRef, useState } from "react";
import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { parseLevelFile } from "@/features/level-file/services/levelFileParser";
import {
  BUILT_IN_LEVEL_URLS,
  loadLevelFromUrl,
  type LoadedLevel,
} from "@/features/level-file/services/levelFileSource";
import type { LevelImportReport } from "@/features/level-file/types/levelFile.types";

export type { LevelImportReport };

/** One playable level of the library: a built-in file or one imported this session. */
export interface LevelLibraryEntry {
  /** Stable id: the URL of a built-in, `import:<n>` for an import. */
  id: string;
  origin: "built-in" | "imported";
  /** Null while a built-in is loading or when it failed (`error`). */
  level: LevelDefinition | null;
  error: string | null;
}

export interface LevelLibrary {
  /** Built-ins in manifest order, then imports in import order. */
  entries: LevelLibraryEntry[];
  report: LevelImportReport | null;
  /** Parses `file`; a valid level joins the library. Resolves to its entry id, else null. */
  importFile: (file: File) => Promise<string | null>;
  dismissReport: () => void;
}

const queryKeyFor = (url: string) => ["level-file", url] as const;

/** Module-level, so TanStack keeps the combined array stable while nothing changed. */
const toBuiltInEntries = (results: UseQueryResult<LoadedLevel>[]): LevelLibraryEntry[] =>
  results.map((query, index) => ({
    id: BUILT_IN_LEVEL_URLS[index] ?? "",
    origin: "built-in",
    level: query.data?.level ?? null,
    error: query.error ? query.error.message : null,
  }));

/**
 * The levels players can pick: the built-in files (`BUILT_IN_LEVEL_URLS`, fetched once with
 * TanStack Query) plus every valid file imported this session. A rejected file adds nothing
 * and reports its errors; every accepted import (even of the same file) is a new entry.
 */
export function useLevelLibrary(): LevelLibrary {
  const builtIns = useQueries({
    queries: BUILT_IN_LEVEL_URLS.map((url) => ({
      queryKey: queryKeyFor(url),
      queryFn: () => loadLevelFromUrl(url),
      staleTime: Infinity,
    })),
    combine: toBuiltInEntries,
  });
  const [imported, setImported] = useState<LevelLibraryEntry[]>([]);
  const [report, setReport] = useState<LevelImportReport | null>(null);
  const importCount = useRef(0);

  const importFile = useCallback(async (file: File): Promise<string | null> => {
    const result = parseLevelFile(await file.text());
    setReport({
      fileName: file.name,
      ok: result.ok,
      errors: result.ok ? [] : result.errors,
      warnings: result.warnings,
    });
    if (!result.ok) return null;
    importCount.current += 1;
    const entry: LevelLibraryEntry = {
      id: `import:${importCount.current}`,
      origin: "imported",
      level: result.level,
      error: null,
    };
    setImported((previous) => [...previous, entry]);
    return entry.id;
  }, []);

  const dismissReport = useCallback(() => setReport(null), []);

  const entries = useMemo(() => [...builtIns, ...imported], [builtIns, imported]);

  return { entries, report, importFile, dismissReport };
}
