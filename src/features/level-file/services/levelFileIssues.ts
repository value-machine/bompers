import { LEVEL_FORMAT_VERSION } from "@/features/level/api/levelApi";
import type {
  LevelErrorCode,
  LevelImportReport,
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

const issueLine = (issue: LevelIssue): string =>
  `- ${issue.code ? `${issue.code} ` : ""}${issue.message}`;

const outcomeLine = (report: LevelImportReport): string => {
  if (!report.ok) return `Rejected: ${report.errors.length} error(s), the game can't run it.`;
  const count = report.warnings.length;
  return count === 0 ? "Loaded without warnings." : `Loaded with ${count} warning(s).`;
};

/**
 * The import report as plain text for the author's AI (level-direction D3): file, outcome, then
 * errors and warnings one per line with their LEVEL_FORMAT § 7 code, so the agent can fix the file.
 */
export function formatLevelImportReport(report: LevelImportReport): string {
  const lines = [
    `Bompers level import report (rules: LEVEL_FORMAT.md § 7, format v${LEVEL_FORMAT_VERSION})`,
    `File: ${report.fileName}`,
    outcomeLine(report),
  ];
  if (report.errors.length > 0) lines.push("", "Errors:", ...report.errors.map(issueLine));
  if (report.warnings.length > 0) lines.push("", "Warnings:", ...report.warnings.map(issueLine));
  return `${lines.join("\n")}\n`;
}
