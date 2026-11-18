import type { ReactNode, Ref } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { Button } from "@/components/common/Button";
import {
  LevelImportControl,
  type LevelFilePicker,
  type LevelLibrary,
  type LevelLibraryEntry,
} from "@/features/level-file/api/levelFileApi";
import { CopyLevelPromptButton } from "@/features/level-kit/api/levelKitApi";
import type { Lobby } from "@/features/lobby/hooks/useLobby";
import type { LobbyAction, LobbyRow, LobbyView } from "@/features/lobby/types/lobby.types";
import { WeaponCrateIcon } from "@/features/lobby/components/WeaponCrateIcon";

export interface LobbyMenuProps {
  lobby: Lobby;
  library: LevelLibrary;
  pickerRef: Ref<LevelFilePicker>;
  onFile: (file: File) => void;
  onAction: (action: LobbyAction) => void;
}

/** Pointer clicks must not move focus: Space / Enter belong to the players, not a button. */
const keepFocus = (event: { preventDefault: () => void }): void => event.preventDefault();

const Row = ({
  row,
  label,
  focused,
  children,
}: {
  row: LobbyRow;
  label: string;
  focused: boolean;
  children: ReactNode;
}) => (
  <div
    data-testid={`lobby-row-${row}`}
    aria-current={focused ? "true" : undefined}
    className={cn(
      "flex min-h-14 flex-wrap items-center gap-3 rounded-xl border-2 border-transparent px-3 py-2",
      focused && "border-ring bg-accent"
    )}
  >
    <span className="w-28 shrink-0 font-semibold">{label}</span>
    <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
  </div>
);

const Stepper = ({
  row,
  value,
  onAction,
}: {
  row: LobbyRow;
  value: ReactNode;
  onAction: (action: LobbyAction) => void;
}) => (
  <>
    <Button
      size="icon"
      variant="ghost"
      aria-label={`Previous ${row}`}
      onMouseDown={keepFocus}
      onClick={() => onAction({ type: "cycle", row, step: -1 })}
    >
      <ChevronLeft aria-hidden="true" />
    </Button>
    <span className="min-w-24 text-center" data-testid={`lobby-value-${row}`}>
      {value}
    </span>
    <Button
      size="icon"
      variant="ghost"
      aria-label={`Next ${row}`}
      onMouseDown={keepFocus}
      onClick={() => onAction({ type: "cycle", row, step: 1 })}
    >
      <ChevronRight aria-hidden="true" />
    </Button>
  </>
);

/**
 * The weapons as their in-game crates, each a toggle (owner, weapons-match-setting D5): on is the
 * crate as it falls, off is greyed and faded but still recognisable. The in-row cursor shows as a
 * ring. While the level sets its weapons the crates show its choice and do not toggle.
 */
const WeaponToggles = ({
  view,
  onAction,
}: {
  view: LobbyView;
  onAction: (action: LobbyAction) => void;
}) => (
  <>
    {view.weapons.map((weapon) => (
      <button
        key={weapon.weaponId}
        type="button"
        aria-pressed={weapon.on}
        aria-disabled={view.weaponsLocked || undefined}
        aria-label={`${weapon.label}: ${weapon.on ? "on" : "off"}`}
        title={weapon.label}
        data-testid={`lobby-weapon-${weapon.weaponId}`}
        onMouseDown={keepFocus}
        onClick={() => onAction({ type: "toggleWeapon", weaponId: weapon.weaponId })}
        className={cn(
          "rounded-lg p-0.5 ring-offset-2 ring-offset-background transition-[filter,opacity] duration-(--duration-fast)",
          !weapon.on && "opacity-40 grayscale",
          weapon.focused && "ring-2 ring-ring",
          view.weaponsLocked ? "cursor-default" : "cursor-pointer"
        )}
      >
        <WeaponCrateIcon weaponId={weapon.weaponId} size={40} />
      </button>
    ))}
    {view.weaponsNote && (
      <span className="text-xs text-muted-foreground" data-testid="lobby-weapons-note">
        {view.weaponsNote}
      </span>
    )}
  </>
);

/** Title, author and origin of the chosen level. */
const LevelValue = ({ entry }: { entry: LevelLibraryEntry | null }) => {
  const level = entry?.level;
  if (!level) return <span className="text-muted-foreground">Loading levels…</span>;
  return (
    <span>
      <span className="font-semibold" data-testid="lobby-level-title">
        {level.meta.title}
      </span>
      {level.meta.author && <span className="text-muted-foreground"> by {level.meta.author}</span>}
      {entry.origin === "imported" && <span className="text-muted-foreground"> · imported</span>}
    </span>
  );
};

const startLabel = (players: number): string =>
  players === 1 ? "Start test round (1 player)" : `Start match (${players} players)`;

/**
 * The shared menu: level, load a level file, match length, weapons, gravity, start, then the music and
 * sound volumes (player preferences, below start). Joined players
 * drive it with their own controls (the highlighted row is the cursor); every row also works
 * with the pointer.
 */
export const LobbyMenu = ({ lobby, library, pickerRef, onFile, onAction }: LobbyMenuProps) => {
  const { selectedLevel, view } = lobby;
  const { focusedRow, players, startable } = view;

  return (
    <div className="flex flex-col gap-1" data-testid="lobby-menu">
      <Row row="level" label="Level" focused={focusedRow === "level"}>
        <Stepper row="level" onAction={onAction} value={<LevelValue entry={selectedLevel} />} />
      </Row>
      <Row row="loadFile" label="Your level" focused={focusedRow === "loadFile"}>
        <LevelImportControl
          report={library.report}
          onFile={onFile}
          onDismiss={library.dismissReport}
          pickerRef={pickerRef}
        />
        <span className="text-xs text-muted-foreground">or drop a level file anywhere</span>
        <CopyLevelPromptButton />
      </Row>
      <Row row="duration" label="Match length" focused={focusedRow === "duration"}>
        <Stepper row="duration" onAction={onAction} value={view.duration} />
        {view.levelDuration && (
          <span className="text-xs text-muted-foreground" data-testid="lobby-duration-note">
            This level plays {view.levelDuration} (set by the level)
          </span>
        )}
      </Row>
      <Row row="weapons" label="Weapons" focused={focusedRow === "weapons"}>
        <WeaponToggles view={view} onAction={onAction} />
      </Row>
      <Row row="gravity" label="Gravity" focused={focusedRow === "gravity"}>
        <Stepper row="gravity" onAction={onAction} value={view.gravity} />
        {view.levelGravity && (
          <span className="text-xs text-muted-foreground">× level {view.levelGravity}</span>
        )}
      </Row>
      <Row row="start" label="" focused={focusedRow === "start"}>
        <Button
          disabled={!startable}
          onMouseDown={keepFocus}
          onClick={() => onAction({ type: "activate", row: "start" })}
        >
          {players === 0 ? "Join to start" : startLabel(players)}
        </Button>
      </Row>
      <Row row="musicVolume" label="Music" focused={focusedRow === "musicVolume"}>
        <Stepper row="musicVolume" onAction={onAction} value={view.musicVolume} />
      </Row>
      <Row row="sfxVolume" label="Sounds" focused={focusedRow === "sfxVolume"}>
        <Stepper row="sfxVolume" onAction={onAction} value={view.sfxVolume} />
      </Row>
    </div>
  );
};
