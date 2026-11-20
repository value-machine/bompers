import { VolumeX } from "lucide-react";
import type { SoundStatus } from "@/features/sound/types/sound.types";
import { cn } from "@/shared/utils/cn";

const STATUS_LABEL: Record<SoundStatus, string> = {
  blocked: "Tap for sound",
  muted: "Sound off",
};

const CHIP_CLASS =
  "flex items-center gap-1.5 rounded-full border-2 border-foreground bg-card px-2.5 py-1 text-sm font-semibold text-card-foreground";

export interface SoundStatusChipProps {
  /** Nothing renders for `null` (the sound plays). */
  status: SoundStatus | null;
  /** `muted` only: the chip becomes a button that turns the sound back on (mute-indicator D1). */
  onUnmute?: () => void;
  className?: string;
}

/**
 * Small pill that tells the player why they hear nothing (owner pick B, gamepad-audio-unlock D1):
 * muted speaker and a label, card fill, ink outline. One chip for every sound status; the muted
 * state adds the M key cap and unmutes on click or tap (mute-indicator D1).
 */
export const SoundStatusChip = ({ status, onUnmute, className }: SoundStatusChipProps) => {
  if (status === null) return null;
  const content = (
    <>
      <VolumeX aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.5} />
      {STATUS_LABEL[status]}
    </>
  );
  if (status === "muted") {
    return (
      <button
        type="button"
        data-sound-status={status}
        aria-label="Sound off. Turn sound on (M)"
        onClick={onUnmute}
        className={cn(CHIP_CLASS, "cursor-pointer active:translate-y-px", className)}
      >
        {content}
        <kbd className="rounded-md bg-foreground px-1.5 font-sans text-xs text-background">M</kbd>
      </button>
    );
  }
  return (
    <div role="status" data-sound-status={status} className={cn(CHIP_CLASS, className)}>
      {content}
    </div>
  );
};
