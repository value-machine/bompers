import { Button } from "@/components/common/Button";
import type {
  LevelLibrary,
  LevelLibraryEntry,
  LevelMemoryState,
} from "@/features/level-file/api/levelFileApi";

/** What the picked imported level's state means, in the player's words. */
const MEMORY_NOTE: Record<LevelMemoryState, string> = {
  copy: "Saved in this browser. Drop the edited file again to update it.",
  linked: "Linked to your file: save it, switch back, and it updates.",
  updated: "Updated from your file.",
  needsPermission: "Playing the saved copy. Relink to read your file again.",
  missing: "File not found. Playing the saved copy.",
};

/** Pointer clicks must not move focus: Space / Enter belong to the players, not a button. */
const keepFocus = (event: { preventDefault: () => void }): void => event.preventDefault();

export interface RememberedLevelActionsProps {
  /** The picked level; only imported levels (with `memory`) show actions. */
  entry: LevelLibraryEntry;
  library: Pick<LevelLibrary, "forget" | "relink">;
  /** Opens the file picker to link a moved file again. */
  onFind: () => void;
}

/** Relink / Find file / Forget for the picked imported level, with a one-line state note. */
export const RememberedLevelActions = ({ entry, library, onFind }: RememberedLevelActionsProps) => {
  const { memory } = entry;
  if (!memory) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="lobby-level-actions">
      {memory === "needsPermission" && (
        <Button
          size="sm"
          variant="secondary"
          onMouseDown={keepFocus}
          onClick={() => void library.relink(entry.id)}
        >
          Relink file
        </Button>
      )}
      {memory === "missing" && (
        <Button size="sm" variant="secondary" onMouseDown={keepFocus} onClick={onFind}>
          Find file…
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        onMouseDown={keepFocus}
        onClick={() => void library.forget(entry.id)}
      >
        Forget
      </Button>
      <span className="text-xs text-muted-foreground" data-testid="lobby-level-memory-note">
        {MEMORY_NOTE[memory]}
      </span>
    </div>
  );
};
