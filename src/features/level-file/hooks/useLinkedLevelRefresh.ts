import { useCallback, useEffect } from "react";
import {
  readIfChanged,
  relinkFile,
  type LinkedRead,
} from "@/features/level-memory/api/levelMemoryApi";
import { parseLevelFile } from "@/features/level-file/services/levelFileParser";
import type {
  LevelImportReport,
  LevelMemoryState,
} from "@/features/level-file/types/levelFile.types";
import type { RememberedLevels, Remembered } from "@/features/level-file/hooks/useRememberedLevels";

/** What to do with one read of a linked file. */
type LinkedOutcome =
  | { kind: "memory"; memory: LevelMemoryState }
  /** The edited file no longer imports (or changed its level id): keep the copy, show why. */
  | { kind: "rejected"; report: LevelImportReport }
  | { kind: "save"; item: Remembered };

function linkedOutcome(item: Remembered, read: LinkedRead): LinkedOutcome {
  if (read.kind === "needsPermission" || read.kind === "missing") {
    return { kind: "memory", memory: read.kind };
  }
  if (read.kind === "unchanged") {
    return { kind: "memory", memory: item.memory === "updated" ? "updated" : "linked" };
  }
  const result = parseLevelFile(read.text);
  if (!result.ok || result.level.meta.levelId !== item.record.levelId) {
    const errors = result.ok ? [] : result.errors;
    return {
      kind: "rejected",
      report: { fileName: read.fileName, ok: false, errors, warnings: result.warnings },
    };
  }
  const record = { ...item.record, text: read.text, lastModified: read.lastModified };
  return { kind: "save", item: { record, level: result.level, memory: "updated" } };
}

export interface LinkedLevelRefreshOptions {
  levels: RememberedLevels;
  onReport: (report: LevelImportReport) => void;
}

/**
 * Keeps linked levels in step with their files (Chrome, Edge): re-reads each one when the window
 * regains focus (the author saved in an editor and switched back), and relinks after a reload.
 * A running match keeps the level it started with, since the match holds its own copy.
 */
export function useLinkedLevelRefresh({ levels, onReport }: LinkedLevelRefreshOptions): {
  relink: (id: string) => Promise<void>;
} {
  const { rememberedRef, save, setMemory, find } = levels;

  const refresh = useCallback(
    async (item: Remembered): Promise<void> => {
      if (!item.record.handle) return;
      const outcome = linkedOutcome(
        item,
        await readIfChanged(item.record.handle, item.record.lastModified)
      );
      if (outcome.kind === "save") return save(outcome.item);
      if (outcome.kind === "rejected") onReport(outcome.report);
      setMemory(item.record.levelId, outcome.kind === "memory" ? outcome.memory : "linked");
    },
    [onReport, save, setMemory]
  );

  useEffect(() => {
    const refreshAll = (): void => {
      if (document.visibilityState === "hidden") return;
      rememberedRef.current.filter((r) => r.record.handle).forEach((r) => void refresh(r));
    };
    window.addEventListener("focus", refreshAll);
    document.addEventListener("visibilitychange", refreshAll);
    return () => {
      window.removeEventListener("focus", refreshAll);
      document.removeEventListener("visibilitychange", refreshAll);
    };
  }, [refresh, rememberedRef]);

  const relink = useCallback(
    async (id: string): Promise<void> => {
      const item = find(id);
      if (!item?.record.handle) return;
      if (await relinkFile(item.record.handle)) await refresh(item);
    },
    [find, refresh]
  );

  return { relink };
}
