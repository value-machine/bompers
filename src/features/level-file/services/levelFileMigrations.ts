import { LEVEL_FORMAT_VERSION } from "@/features/level/api/levelApi";
import type { LevelFileMigration } from "@/features/level-file/types/levelFile.types";

/**
 * Format-version migrations (LEVEL_FORMAT § 8). Key N upgrades a format-N root to N+1 in place,
 * before validation; importing a format-N file runs every step up to the game's version.
 * Format 2 (one `terrain` role, material + colour) shipped without a v1 → v2 step: the owner
 * waived compatibility (material-system D2), so a v1 file is rejected with E2. Later breaking
 * versions add `N: migrateVNToVN+1` here with a fixture test; entries are never removed.
 */
export const LEVEL_FILE_MIGRATIONS: Readonly<Record<number, LevelFileMigration>> = {};

export interface MigrationOptions {
  /** The version the game reads (default: LEVEL_FORMAT_VERSION). */
  toVersion?: number;
  migrations?: Readonly<Record<number, LevelFileMigration>>;
}

export type MigrationResult = { ok: true } | { ok: false; missingStep: number };

/** Runs `from → to` steps on the root and stamps the new version on it. */
export function migrateLevelRoot(
  root: Element,
  fromVersion: number,
  options: MigrationOptions = {}
): MigrationResult {
  const toVersion = options.toVersion ?? LEVEL_FORMAT_VERSION;
  const migrations = options.migrations ?? LEVEL_FILE_MIGRATIONS;
  for (let version = fromVersion; version < toVersion; version += 1) {
    const step = migrations[version];
    if (!step) return { ok: false, missingStep: version };
    step(root);
    root.setAttribute("data-level-format", String(version + 1));
  }
  return { ok: true };
}
