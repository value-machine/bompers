import { X } from "lucide-react";
import { PLAYER_EMBLEM_GLYPHS } from "@/shared/utils/playerEmblem";
import { cn } from "@/shared/utils/cn";
import { Button } from "@/components/common/Button";
import type { DeviceActivity } from "@/features/lobby/hooks/useLobbyInput";
import type { SlotView } from "@/features/lobby/types/lobby.types";
import { BlobBadge } from "@/features/lobby/components/BlobBadge";

export interface PlayerSlotCardProps {
  view: SlotView;
  /** Live state of the slot's device; null for an empty slot. */
  activity: DeviceActivity | null;
  onLeave: () => void;
}

/** Lights while the device is heard; hollow while a joined pad is unplugged. */
export const InputIndicator = ({ activity }: { activity: DeviceActivity | null }) => (
  <span
    aria-hidden="true"
    className={cn(
      "inline-block size-3 rounded-full border-2 border-foreground/40",
      activity?.present && "bg-muted-foreground/40",
      activity?.active && "border-success bg-success"
    )}
  />
);

const statusText = (activity: DeviceActivity | null): string => {
  if (!activity?.present) return "not connected";
  return activity.active ? "input" : "ready";
};

/** One of the four player slots: the joined blob with its device, or a join prompt. */
export const PlayerSlotCard = ({ view, activity, onLeave }: PlayerSlotCardProps) => {
  const { slot } = view;
  const name = `P${slot + 1}`;
  if (view.deviceIndex === -1) {
    return (
      <div
        data-testid={`player-slot-${slot}`}
        data-joined="false"
        className="flex min-h-44 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-border p-4 text-center text-sm text-muted-foreground"
      >
        <span className="text-lg font-semibold">
          {name} {PLAYER_EMBLEM_GLYPHS[slot % 4]}
        </span>
        <span>Press Space, Enter or pad A to join</span>
      </div>
    );
  }
  return (
    <div
      data-testid={`player-slot-${slot}`}
      data-joined="true"
      className="relative flex min-h-44 flex-col items-center gap-1 rounded-2xl border-2 border-foreground bg-card p-4 text-center text-card-foreground elevation-md"
    >
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-1 right-1"
        aria-label={`Remove ${name}`}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onLeave}
      >
        <X aria-hidden="true" />
      </Button>
      <BlobBadge slot={slot} />
      <span className="text-lg font-bold">
        {name} {PLAYER_EMBLEM_GLYPHS[slot % 4]}
      </span>
      <span
        className="flex items-center gap-2 text-sm"
        data-testid={`player-slot-${slot}-input`}
        data-status={statusText(activity)}
      >
        <InputIndicator activity={activity} />
        {view.deviceLabel} · {statusText(activity)}
      </span>
      <span className="text-xs text-muted-foreground">Leave: {view.leaveKey}</span>
    </div>
  );
};
