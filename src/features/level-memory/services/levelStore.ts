import type { LevelRecord, LevelStore } from "@/features/level-memory/types/levelMemory.types";

const DB_NAME = "bompers-levels";
const DB_VERSION = 1;
const STORE = "imported";

/** A store held in memory: tests, and the fallback when IndexedDB is blocked (private window). */
export function createMemoryLevelStore(initial: readonly LevelRecord[] = []): LevelStore {
  const records = new Map(initial.map((r) => [r.levelId, r]));
  return {
    list: () => Promise.resolve([...records.values()].sort((a, b) => a.savedAt - b.savedAt)),
    put: (record) => {
      records.set(record.levelId, record);
      return Promise.resolve();
    },
    remove: (levelId) => {
      records.delete(levelId);
      return Promise.resolve();
    },
  };
}

const asPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  const request = factory.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE)) {
      request.result.createObjectStore(STORE, { keyPath: "levelId" });
    }
  };
  return asPromise(request);
}

/**
 * One IndexedDB object store keyed by `levelId` (level-file-handle plan). Opening it lazily
 * means a blocked database only fails the first call, which the caller turns into the memory
 * fallback.
 */
export function createIndexedDbLevelStore(factory: IDBFactory): LevelStore {
  let db: Promise<IDBDatabase> | null = null;
  const objects = async (mode: IDBTransactionMode): Promise<IDBObjectStore> => {
    db ??= openDatabase(factory);
    return (await db).transaction(STORE, mode).objectStore(STORE);
  };
  return {
    list: async () => {
      const all = (await asPromise((await objects("readonly")).getAll())) as LevelRecord[];
      return all.sort((a, b) => a.savedAt - b.savedAt);
    },
    put: async (record) => {
      await asPromise((await objects("readwrite")).put(record));
    },
    remove: async (levelId) => {
      await asPromise((await objects("readwrite")).delete(levelId));
    },
  };
}

/**
 * The browser's level store: IndexedDB when it opens, else memory for the session (imports work
 * as before, they just do not survive a reload). Never rejects.
 */
export function createBrowserLevelStore(): LevelStore {
  const memory = createMemoryLevelStore();
  const factory = typeof indexedDB === "undefined" ? null : indexedDB;
  if (!factory) return memory;
  const db = createIndexedDbLevelStore(factory);
  let active: LevelStore = db;
  const withFallback =
    <A extends unknown[], R>(call: (store: LevelStore, ...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      try {
        return await call(active, ...args);
      } catch (error: unknown) {
        if (import.meta.env.VITE_DEBUG_API) console.warn("Level store unavailable", error);
        active = memory;
        return call(active, ...args);
      }
    };
  return {
    list: withFallback((store) => store.list()),
    put: withFallback((store, record: LevelRecord) => store.put(record)),
    remove: withFallback((store, levelId: string) => store.remove(levelId)),
  };
}
