import { SoundStatusChip } from "@/features/sound/components/SoundStatusChip";
import { useSoundStatus } from "@/features/sound/hooks/useAudioEngine";
import { cn } from "@/shared/utils/cn";

const PLACEMENT = {
  /** Lobby: the free top-right corner. */
  "top-right": "top-2 right-2",
  /** Match: clear of the HUD player cards along the top, above the controls hint. */
  "bottom-right": "bottom-10 right-2",
} as const;

export interface SoundStatusCornerProps {
  placement: keyof typeof PLACEMENT;
}

/**
 * The app's one place for the sound-status chip (lobby and match render the same thing). Place it
 * inside a `relative` container; a tap anywhere starts blocked sound.
 */
export const SoundStatusCorner = ({ placement }: SoundStatusCornerProps) => (
  <SoundStatusChip
    status={useSoundStatus()}
    className={cn("absolute z-20", PLACEMENT[placement])}
  />
);
