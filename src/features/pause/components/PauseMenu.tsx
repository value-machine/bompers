import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { useMenuFocusVisible } from "@/shared/hooks/useMenuFocusVisible";
import { Button } from "@/components/common/Button";
import { VOLUME_STEPS, type SoundSettings } from "@/features/sound/api/soundApi";
import type { PauseAction, PauseMenuState, PauseRow } from "@/features/pause/types/pause.types";

export interface PauseMenuProps {
  menu: PauseMenuState;
  focusedRow: PauseRow;
  sound: SoundSettings;
  onAction: (action: PauseAction) => void;
}

/** Pointer clicks must not move focus: Space / Enter belong to the players, not a button. */
const keepFocus = (event: { preventDefault: () => void }): void => event.preventDefault();

// Second copy of the menu-row look: LobbyMenu's `Row` / `Stepper` (lobby feature). A third
// keyboard-and-pad menu extracts both into a shared menu-row primitive (code-style F2).
const Row = ({
  row,
  label,
  focused,
  children,
}: {
  row: PauseRow;
  label: string;
  focused: boolean;
  children: ReactNode;
}) => (
  <div
    data-testid={`pause-row-${row}`}
    aria-current={focused ? "true" : undefined}
    className={cn(
      "flex min-h-12 items-center gap-3 rounded-xl px-3 py-1",
      // The mark shows only after key / pad input (data-menu-focus on the menu root).
      focused && "group-data-[menu-focus=on]/menu:menu-focus-row"
    )}
  >
    <span className="w-28 shrink-0 font-semibold">{label}</span>
    <div className="flex flex-1 items-center gap-2">{children}</div>
  </div>
);

const Stepper = ({
  row,
  name,
  value,
  onAction,
}: {
  row: PauseRow;
  /** Visible row label, also the buttons' accessible name. */
  name: string;
  value: string;
  onAction: (action: PauseAction) => void;
}) => (
  <>
    <Button
      size="icon"
      variant="ghost"
      aria-label={`Lower ${name}`}
      onMouseDown={keepFocus}
      onClick={() => onAction({ type: "cycle", row, step: -1 })}
    >
      <ChevronLeft aria-hidden="true" />
    </Button>
    <span className="min-w-10 text-center">{value}</span>
    <Button
      size="icon"
      variant="ghost"
      aria-label={`Raise ${name}`}
      onMouseDown={keepFocus}
      onClick={() => onAction({ type: "cycle", row, step: 1 })}
    >
      <ChevronRight aria-hidden="true" />
    </Button>
  </>
);

const volumeLabel = (volume: number): string => String(Math.round(volume * VOLUME_STEPS));

/**
 * The in-match pause overlay: the match is frozen behind it. Every player in the match drives
 * the highlighted row with their own controls; every row also works with the pointer. Only
 * player preferences — match settings stay in the lobby.
 */
export const PauseMenu = ({ menu, focusedRow: focused, sound, onAction }: PauseMenuProps) => {
  const focusVisible = useMenuFocusVisible();
  if (!menu.open) return null;
  const activate = (row: PauseRow) => () => onAction({ type: "activate", row });
  const action = (row: PauseRow, label: string, variant: "default" | "outline" = "outline") => (
    <Button variant={variant} onMouseDown={keepFocus} onClick={activate(row)}>
      {label}
    </Button>
  );

  return (
    <div
      className="group/menu absolute inset-0 flex items-center justify-center bg-background/70"
      data-menu-focus={focusVisible ? "on" : "off"}
      data-testid="pause-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Paused"
    >
      <div className="flex w-full max-w-md flex-col gap-1 rounded-2xl border bg-card p-4 text-card-foreground shadow-lg">
        <h2 className="mb-2 text-center text-2xl font-bold">Paused</h2>
        <Row row="resume" label="" focused={focused === "resume"}>
          {action("resume", "Resume", "default")}
        </Row>
        <Row row="music" label="Music" focused={focused === "music"}>
          {action("music", sound.musicEnabled ? "On" : "Off")}
        </Row>
        <Row row="sfx" label="Sounds" focused={focused === "sfx"}>
          {action("sfx", sound.sfxEnabled ? "On" : "Off")}
        </Row>
        <Row row="musicVolume" label="Music volume" focused={focused === "musicVolume"}>
          <Stepper
            row="musicVolume"
            name="music volume"
            value={volumeLabel(sound.musicVolume)}
            onAction={onAction}
          />
        </Row>
        <Row row="sfxVolume" label="Sounds volume" focused={focused === "sfxVolume"}>
          <Stepper
            row="sfxVolume"
            name="sounds volume"
            value={volumeLabel(sound.sfxVolume)}
            onAction={onAction}
          />
        </Row>
        <Row row="mainMenu" label="" focused={focused === "mainMenu"}>
          {action("mainMenu", "Main menu")}
        </Row>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Esc / Start or back: resume
        </p>
      </div>
    </div>
  );
};
