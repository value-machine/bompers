import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import type { LevelRecord, LevelStore } from "@/features/level-memory/api/levelMemoryApi";
import { parseLevelFile } from "@/features/level-file/services/levelFileParser";
import type { LevelMemoryState } from "@/features/level-file/types/levelFile.types";

/** A remembered level: its record (the source) and what the library shows. */
export interface Remembered {
  record: LevelRecord;
  level: LevelDefinition;
  memory: LevelMemoryState;
}

export const importedEntryId = (levelId: string): string => `import:${levelId}`;

const initialMemory = (record: LevelRecord): LevelMemoryState =>
  record.handle ? "needsPermission" : "copy";

/** Records that still parse, in save order; one that no longer parses is skipped, not deleted. */
function rememberAll(records: readonly LevelRecord[]): Remembered[] {
  return records.flatMap((record) => {
    const result = parseLevelFile(record.text);
    if (!result.ok) return [];
    return [{ record, level: result.level, memory: initialMemory(record) }];
  });
}

/** Replaces the item with the same level id in place, else appends it. */
function upsert(list: readonly Remembered[], item: Remembered): Remembered[] {
  const at = list.findIndex((r) => r.record.levelId === item.record.levelId);
  if (at === -1) return [...list, item];
  return list.map((r, i) => (i === at ? item : r));
}

export interface RememberedLevels {
  remembered: Remembered[];
  /** Always the latest list, for event handlers. */
  rememberedRef: RefObject<Remembered[]>;
  /** Shows the item now (replacing its level id) and writes it to the store. */
  save: (item: Remembered) => Promise<void>;
  setMemory: (levelId: string, memory: LevelMemoryState) => void;
  /** The remembered level behind a library entry id. */
  find: (id: string) => Remembered | undefined;
  forget: (id: string) => Promise<void>;
}

/** The imported levels kept in `store`: loaded once on mount, then kept in step with it. */
export function useRememberedLevels(store: LevelStore): RememberedLevels {
  const [remembered, setRemembered] = useState<Remembered[]>([]);
  const rememberedRef = useRef(remembered);
  rememberedRef.current = remembered;

  useEffect(() => {
    let live = true;
    void store.list().then((records) => {
      if (!live) return;
      // Imports made while the store was loading win over their older saved copies.
      setRemembered((current) => current.reduce(upsert, rememberAll(records)));
    });
    return () => {
      live = false;
    };
  }, [store]);

  const save = useCallback(
    async (item: Remembered): Promise<void> => {
      setRemembered((current) => upsert(current, item));
      await store.put(item.record);
    },
    [store]
  );

  const setMemory = useCallback((levelId: string, memory: LevelMemoryState): void => {
    setRemembered((current) =>
      current.map((r) => (r.record.levelId === levelId ? { ...r, memory } : r))
    );
  }, []);

  const find = useCallback(
    (id: string): Remembered | undefined =>
      rememberedRef.current.find((r) => importedEntryId(r.record.levelId) === id),
    []
  );

  const forget = useCallback(
    async (id: string): Promise<void> => {
      const item = find(id);
      if (!item) return;
      setRemembered((current) => current.filter((r) => r !== item));
      await store.remove(item.record.levelId);
    },
    [find, store]
  );

  return { remembered, rememberedRef, save, setMemory, find, forget };
}
