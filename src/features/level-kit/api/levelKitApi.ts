/**
 * Public seam of the level kit: the material that teaches outside authors and AI agents to write
 * level files — the copyable AI prompt (button + text) and the generated kit files the sync script
 * writes.
 */
export { CopyLevelPromptButton } from "@/features/level-kit/components/CopyLevelPromptButton";
export { LEVEL_KIT_ORIGIN, buildLevelPrompt } from "@/features/level-kit/services/levelPrompt";
export { planLevelKitSync } from "@/features/level-kit/services/levelKitExport";
