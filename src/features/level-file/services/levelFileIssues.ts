import type {
  LevelErrorCode,
  LevelIssue,
  LevelWarningCode,
} from "@/features/level-file/types/levelFile.types";

/** Collects a parse run's errors and warnings in document order. */
export interface LevelIssueLog {
  errors: LevelIssue[];
  warnings: LevelIssue[];
}

export const createIssueLog = (): LevelIssueLog => ({ errors: [], warnings: [] });

export function addError(log: LevelIssueLog, code: LevelErrorCode, message: string): void {
  log.errors.push({ code, message });
}

export function addWarning(log: LevelIssueLog, code: LevelWarningCode, message: string): void {
  log.warnings.push({ code, message });
}
