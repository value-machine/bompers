import { useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { LevelThumbnail } from "@/features/level/api/levelApi";
import type { LevelLibraryEntry, LevelMemoryState } from "@/features/level-file/api/levelFileApi";

/** The chip on an imported level's card (owner pick: the thumbnail strip, 2026-11-18). */
export const MEMORY_CHIP: Record<LevelMemoryState, { label: string; tone: string }> = {
  copy: { label: "Saved copy", tone: "text-muted-foreground" },
  linked: { label: "Linked", tone: "text-success" },
  updated: { label: "Updated", tone: "text-success" },
  needsPermission: { label: "Relink", tone: "text-warning" },
  missing: { label: "File missing", tone: "text-warning" },
};

export interface LevelStripProps {
  entries: readonly LevelLibraryEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onLoad: () => void;
}

/** Pointer clicks must not move focus: Space / Enter belong to the players, not a button. */
const keepFocus = (event: { preventDefault: () => void }): void => event.preventDefault();

const CARD =
  "flex w-36 shrink-0 snap-center flex-col gap-1 rounded-xl border-2 border-transparent p-1.5 text-left transition-transform duration-(--duration-fast)";

/**
 * The level picker as a strip of thumbnail cards: built-ins first, then the imported levels,
 * then a "Load level" card. The picked card lifts and scrolls into view; an imported card shows
 * how it is remembered. Left / right on the row still cycles the pick (the lobby reducer).
 */
export const LevelStrip = ({ entries, selectedId, onSelect, onLoad }: LevelStripProps) => {
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const picked = stripRef.current?.querySelector<HTMLElement>("[aria-pressed='true']");
    picked?.scrollIntoView?.({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [selectedId]);

  return (
    <div
      ref={stripRef}
      // contain-inline-size: the cards never size the strip (or the lobby around it), so a long
      // library scrolls inside the strip instead of widening the page.
      className="flex w-full snap-x gap-3 overflow-x-auto px-1 pt-2 pb-3 contain-inline-size"
      data-testid="lobby-level-strip"
    >
      {entries.map((entry) => {
        const { level } = entry;
        if (!level) return null;
        const picked = entry.id === selectedId;
        const chip = entry.memory ? MEMORY_CHIP[entry.memory] : null;
        return (
          <button
            key={entry.id}
            type="button"
            aria-pressed={picked}
            data-testid={`lobby-level-card-${entry.id}`}
            onMouseDown={keepFocus}
            onClick={() => onSelect(entry.id)}
            className={cn(CARD, picked && "-translate-y-1 border-foreground bg-card elevation-md")}
          >
            <span className="relative block">
              <LevelThumbnail level={level} className="block aspect-[16/10] w-full rounded-lg" />
              {chip && (
                <span
                  className={cn(
                    "absolute top-1 left-1 rounded-full border-2 border-foreground bg-card px-2 text-xs font-semibold",
                    chip.tone
                  )}
                  data-testid={`lobby-level-chip-${entry.id}`}
                >
                  {chip.label}
                </span>
              )}
            </span>
            <span className="text-sm leading-tight font-semibold">{level.meta.title}</span>
            <span className="text-xs text-muted-foreground">
              {entry.origin === "imported" ? "Your level" : (level.meta.author ?? "Built-in")}
            </span>
          </button>
        );
      })}
      <button
        type="button"
        onMouseDown={keepFocus}
        onClick={onLoad}
        className={CARD}
        data-testid="lobby-level-card-load"
      >
        <span className="flex aspect-[16/10] w-full items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border font-semibold text-muted-foreground">
          <Plus aria-hidden="true" className="size-4" />
          Load level
        </span>
        <span className="text-xs text-muted-foreground">or drop a file anywhere</span>
      </button>
    </div>
  );
};
