import { VolumeX } from "lucide-react";
import type { SoundStatus } from "@/features/sound/types/sound.types";
import { cn } from "@/shared/utils/cn";

const STATUS_LABEL: Record<SoundStatus, string> = {
  blocked: "Tap for sound",
};

export interface SoundStatusChipProps {
  /** Nothing renders for `null` (the sound plays). */
  status: SoundStatus | null;
  className?: string;
}

/**
 * Small pill that tells the player why they hear nothing (owner pick B, gamepad-audio-unlock D1):
 * muted speaker and a label, card fill, ink outline. One chip for every sound status.
 */
export const SoundStatusChip = ({ status, className }: SoundStatusChipProps) => {
  if (status === null) return null;
  return (
    <div
      role="status"
      data-sound-status={status}
      className={cn(
        "flex items-center gap-1.5 rounded-full border-2 border-foreground bg-card px-2.5 py-1 text-sm font-semibold text-card-foreground",
        className
      )}
    >
      <VolumeX aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.5} />
      {STATUS_LABEL[status]}
    </div>
  );
};
