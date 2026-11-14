import { useImperativeHandle, useRef, type ChangeEvent, type Ref } from "react";
import { Upload } from "lucide-react";
import { Alert } from "@/components/common/Alert";
import { Button } from "@/components/common/Button";
import type { LevelImportReport } from "@/features/level-file/hooks/useLevelLibrary";

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
