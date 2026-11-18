import { useImperativeHandle, useRef, type ChangeEvent, type Ref } from "react";
import { Check, Copy, Upload } from "lucide-react";
import { Alert } from "@/components/common/Alert";
import { Button } from "@/components/common/Button";
import type { ClipboardCopyStatus } from "@/shared/hooks/useClipboardCopy";
import { useImportReportCopy } from "@/features/level-file/hooks/useImportReportCopy";
import type { LevelImportReport } from "@/features/level-file/types/levelFile.types";

/** Level files are HTML; a bare .svg with the same root works too. */
const LEVEL_FILE_ACCEPT = ".html,.htm,.svg,text/html,image/svg+xml";

/** Opens the file picker from code (a menu row chosen with the keyboard). */
export interface LevelFilePicker {
  open: () => void;
}

export interface LevelImportControlProps {
  report: LevelImportReport | null;
  onFile: (file: File) => void;
  onDismiss: () => void;
  /** Optional handle to open the picker without clicking the button. */
  pickerRef?: Ref<LevelFilePicker>;
}

const COPY_REPORT_LABEL: Record<ClipboardCopyStatus, string> = {
  idle: "Copy report",
  copied: "Report copied",
  failed: "Copy failed",
};

/**
 * Copies the report as plain text for the author's AI (level-direction D3). Second copy of the
 * ghost copy button: level-kit's `CopyLevelPromptButton` is the first (code-style F2).
 */
const CopyReportButton = ({ report }: { report: LevelImportReport }) => {
  const { status, copy } = useImportReportCopy(report);
  return (
    <Button
      size="sm"
      variant="ghost"
      className="mt-1 -ml-2"
      onClick={copy}
      title="Paste into the AI that wrote the level so it can fix the file"
      data-testid="copy-import-report"
    >
      {status === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      <span aria-live="polite">{COPY_REPORT_LABEL[status]}</span>
    </Button>
  );
};

const ReportBody = ({ report }: { report: LevelImportReport }) => {
  const issues = report.ok ? report.warnings : report.errors;
  const heading = report.ok
    ? `Loaded “${report.fileName}”${issues.length > 0 ? ` with ${issues.length} warning(s)` : ""}.`
    : `“${report.fileName}” can't be played:`;
  return (
    <>
      <p className="font-medium">{heading}</p>
      {issues.length > 0 && (
        <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-4 text-xs">
          {issues.map((issue, i) => (
            <li key={i}>
              {issue.code && <span className="font-mono">{issue.code} </span>}
              {issue.message}
            </li>
          ))}
        </ul>
      )}
      {issues.length > 0 && <CopyReportButton report={report} />}
    </>
  );
};

/** "Load level" button (file picker) plus the last import's errors or warnings. */
export const LevelImportControl = ({
  report,
  onFile,
  onDismiss,
  pickerRef,
}: LevelImportControlProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(pickerRef, () => ({ open: () => inputRef.current?.click() }), []);
  const onChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    // Reset so picking the same file again still fires `change` (and restarts the match).
    event.target.value = "";
    if (file) onFile(file);
  };
  const variant = !report
    ? undefined
    : !report.ok
      ? "destructive"
      : report.warnings.length > 0
        ? "warning"
        : "success";

  return (
    <div className="flex w-80 max-w-[calc(100vw-1rem)] flex-col items-end gap-2">
      <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>
        <Upload aria-hidden="true" />
        Load level
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={LEVEL_FILE_ACCEPT}
        className="hidden"
        data-testid="level-file-input"
        onChange={onChange}
      />
      {report && (
        <Alert variant={variant} onClose={onDismiss} className="bg-card">
          <ReportBody report={report} />
        </Alert>
      )}
    </div>
  );
};
