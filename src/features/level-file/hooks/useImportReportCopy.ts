import { useCallback } from "react";
import { useClipboardCopy, type ClipboardCopy } from "@/shared/hooks/useClipboardCopy";
import { formatLevelImportReport } from "@/features/level-file/services/levelFileIssues";
import type { LevelImportReport } from "@/features/level-file/types/levelFile.types";

/** Copies the import report as plain text for the author's AI (level-direction D3). */
export function useImportReportCopy(report: LevelImportReport): ClipboardCopy {
  const getText = useCallback(() => formatLevelImportReport(report), [report]);
  return useClipboardCopy(getText);
}
