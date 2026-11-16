import { useCallback, useEffect, useRef, useState } from "react";

export type ClipboardCopyStatus = "idle" | "copied" | "failed";

/** How long the "copied" / "failed" feedback stays before the control reads idle again. */
const FEEDBACK_MS = 2000;

export interface ClipboardCopy {
  status: ClipboardCopyStatus;
  /** Writes the text from `getText` to the clipboard (called on click, so the browser allows it). */
  copy: () => void;
}

/**
 * Copies text to the clipboard with short-lived feedback. `getText` runs at click time, so the
 * text is built only when someone copies it (level-gen-prompt D3: browser Clipboard API, no package).
 */
export function useClipboardCopy(getText: () => string): ClipboardCopy {
  const [status, setStatus] = useState<ClipboardCopyStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const show = useCallback((next: ClipboardCopyStatus): void => {
    setStatus(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), FEEDBACK_MS);
  }, []);

  const copy = useCallback((): void => {
    const write = navigator.clipboard?.writeText(getText());
    if (!write) {
      show("failed");
      return;
    }
    write.then(
      () => show("copied"),
      () => show("failed")
    );
  }, [getText, show]);

  return { status, copy };
}
