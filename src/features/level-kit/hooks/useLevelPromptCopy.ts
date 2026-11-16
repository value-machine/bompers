import { useClipboardCopy, type ClipboardCopy } from "@/features/level-kit/hooks/useClipboardCopy";
import { buildLevelPrompt } from "@/features/level-kit/services/levelPrompt";

const levelPrompt = (): string => buildLevelPrompt();

/** Copies the level-generation prompt built from the live format, catalog and tunables. */
export const useLevelPromptCopy = (): ClipboardCopy => useClipboardCopy(levelPrompt);
