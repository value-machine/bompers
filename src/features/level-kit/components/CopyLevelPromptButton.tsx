import { Check, Copy } from "lucide-react";
import { Button } from "@/components/common/Button";
import type { ClipboardCopyStatus } from "@/shared/hooks/useClipboardCopy";
import { useLevelPromptCopy } from "@/features/level-kit/hooks/useLevelPromptCopy";

const COPY_LABEL: Record<ClipboardCopyStatus, string> = {
  idle: "Copy AI prompt",
  copied: "Prompt copied",
  failed: "Copy failed",
};

/**
 * Copies the level-generation prompt: paste it into any AI agent, describe the map at the end,
 * and load the file it returns (feedback round 2 § 2.1, level-gen-prompt D1).
 */
export const CopyLevelPromptButton = () => {
  const { status, copy } = useLevelPromptCopy();
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={copy}
      title="Paste into any AI chat, describe your map at the end, then load the file it makes"
      data-testid="copy-level-prompt"
    >
      {status === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      <span aria-live="polite">{COPY_LABEL[status]}</span>
    </Button>
  );
};
