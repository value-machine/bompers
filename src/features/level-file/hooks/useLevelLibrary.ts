import { useCallback, useMemo, useState } from "react";
import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import {
  createBrowserLevelStore,
  type LevelRecord,
  type LevelStore,
} from "@/features/level-memory/api/levelMemoryApi";
import { useLinkedLevelRefresh } from "@/features/level-file/hooks/useLinkedLevelRefresh";
import {
  importedEntryId,
  useRememberedLevels,
  type Remembered,
} from "@/features/level-file/hooks/useRememberedLevels";
import { parseLevelFile } from "@/features/level-file/services/levelFileParser";
import {
  BUILT_IN_LEVEL_URLS,
  loadLevelFromUrl,
  type LoadedLevel,
} from "@/features/level-file/services/levelFileSource";
import type {
  LevelImportReport,
  LevelMemoryState,
} from "@/features/level-file/types/levelFile.types";

export type { LevelImportReport, LevelMemoryState };

/** One playable level of the library: a built-in file or a remembered import. */
export interface LevelLibraryEntry {
  /** Stable id: the URL of a built-in, `import:<levelId>` for an import. */
  id: string;
  origin: "built-in" | "imported";
  /** Null while a built-in is loading or when it failed (`error`). */
  level: LevelDefinition | null;
  error: string | null;
  /** Imported levels only. */
  memory?: LevelMemoryState;
}

export interface LevelLibrary {
  /** Built-ins in manifest order, then imports in the order they were first saved. */
  entries: LevelLibraryEntry[];
  report: LevelImportReport | null;
  /**
   * Parses `file`; a valid level is saved (replacing one with the same level id) and, with a
   * `handle`, linked to its file. Resolves to its entry id, else null.
   */
  importFile: (file: File, handle?: FileSystemFileHandle) => Promise<string | null>;
  /** Removes an imported level from the library and the browser. */
  forget: (id: string) => Promise<void>;
  /** Asks again to read a linked file (call from a click), then re-reads it. */
  relink: (id: string) => Promise<void>;
  dismissReport: () => void;
}

export interface LevelLibraryOptions {
  /** Where imports are remembered; defaults to the browser's (IndexedDB, memory fallback). */
  store?: LevelStore;
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

const reportOf = (
  fileName: string,
  result: ReturnType<typeof parseLevelFile>
): LevelImportReport => ({
  fileName,
  ok: result.ok,
  errors: result.ok ? [] : result.errors,
  warnings: result.warnings,
});

const toImportedEntry = (item: Remembered): LevelLibraryEntry => ({
  id: importedEntryId(item.record.levelId),
  origin: "imported",
  level: item.level,
  error: null,
  memory: item.memory,
});

/** Module-level default, so every library in the page shares one database connection. */
let browserStore: LevelStore | null = null;
const defaultStore = (): LevelStore => (browserStore ??= createBrowserLevelStore());

/**
 * The levels players can pick: the built-in files (`BUILT_IN_LEVEL_URLS`, fetched once with
 * TanStack Query) plus every imported level remembered in this browser. A rejected file adds
 * nothing and reports its errors; an accepted one replaces the import with the same level id
 * (owner, 2026-11-18). Linked files are re-read when the window regains focus; a running match
 * keeps the level it started with (the match holds its own copy).
 */
export function useLevelLibrary(options: LevelLibraryOptions = {}): LevelLibrary {
  const store = options.store ?? defaultStore();
  const builtIns = useQueries({
    queries: BUILT_IN_LEVEL_URLS.map((url) => ({
      queryKey: queryKeyFor(url),
      queryFn: () => loadLevelFromUrl(url),
      staleTime: Infinity,
    })),
    combine: toBuiltInEntries,
  });
  const [report, setReport] = useState<LevelImportReport | null>(null);
  const levels = useRememberedLevels(store);
  const { remembered, save, forget } = levels;
  const { relink } = useLinkedLevelRefresh({ levels, onReport: setReport });

  const importFile = useCallback(
    async (file: File, handle?: FileSystemFileHandle): Promise<string | null> => {
      const text = await file.text();
      const result = parseLevelFile(text);
      setReport(reportOf(file.name, result));
      if (!result.ok) return null;
      const record: LevelRecord = {
        levelId: result.level.meta.levelId,
        fileName: file.name,
        text,
        lastModified: file.lastModified,
        savedAt: Date.now(),
        ...(handle ? { handle } : {}),
      };
      await save({ record, level: result.level, memory: handle ? "linked" : "copy" });
      return importedEntryId(record.levelId);
    },
    [save]
  );

  const dismissReport = useCallback(() => setReport(null), []);

  const entries = useMemo(
    () => [...builtIns, ...remembered.map(toImportedEntry)],
    [builtIns, remembered]
  );

  return { entries, report, importFile, forget, relink, dismissReport };
}
