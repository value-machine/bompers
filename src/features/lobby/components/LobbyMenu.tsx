import type { ReactNode, Ref } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { useMenuFocusVisible } from "@/shared/hooks/useMenuFocusVisible";
import { Button } from "@/components/common/Button";
import {
  LevelImportControl,
  type LevelFilePicker,
  type LevelLibrary,
} from "@/features/level-file/api/levelFileApi";
import { CopyLevelPromptButton } from "@/features/level-kit/api/levelKitApi";
import type { Lobby } from "@/features/lobby/hooks/useLobby";
import type { LobbyAction, LobbyRow, LobbyView } from "@/features/lobby/types/lobby.types";
import { WeaponCrateIcon } from "@/features/lobby/components/WeaponCrateIcon";
import { LevelStrip } from "@/features/lobby/components/LevelStrip";
import { RememberedLevelActions } from "@/features/lobby/components/RememberedLevelActions";

export interface LobbyMenuProps {
  lobby: Lobby;
  library: LevelLibrary;
  pickerRef: Ref<LevelFilePicker>;
  onFile: (file: File, handle?: FileSystemFileHandle) => void;
  /** Opens the level file picker (the strip's "Load level" card). */
  onLoad: () => void;
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
      "flex min-h-14 flex-wrap items-center gap-3 rounded-xl px-3 py-2",
      // The mark shows only after key / pad input (data-menu-focus on the menu root).
      focused && "group-data-[menu-focus=on]/menu:menu-focus-row"
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
          "rounded-lg p-0.5 transition-[filter,opacity] duration-(--duration-fast)",
          !weapon.on && "opacity-40 grayscale",
          weapon.focused && "group-data-[menu-focus=on]/menu:menu-focus",
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

const startLabel = (players: number): string =>
  players === 1 ? "Start test round (1 player)" : `Start match (${players} players)`;

/**
 * The shared menu: level, load a level file, match length, weapons, gravity, start, then the music and
 * sound volumes (player preferences, below start). Joined players
 * drive it with their own controls (the highlighted row is the cursor); every row also works
 * with the pointer.
 */
export const LobbyMenu = ({
  lobby,
  library,
  pickerRef,
  onFile,
  onLoad,
  onAction,
}: LobbyMenuProps) => {
  const { selectedLevel, view } = lobby;
  const { focusedRow, players, startable } = view;
  const focusVisible = useMenuFocusVisible();

  return (
    <div
      className="group/menu flex flex-col gap-1"
      data-testid="lobby-menu"
      data-menu-focus={focusVisible ? "on" : "off"}
    >
      <Row row="level" label="Level" focused={focusedRow === "level"}>
        {selectedLevel ? (
          <LevelStrip
            entries={library.entries}
            selectedId={selectedLevel.id}
            onSelect={(levelId) => onAction({ type: "selectLevel", levelId })}
            onLoad={onLoad}
          />
        ) : (
          <span className="text-muted-foreground" data-testid="lobby-value-level">
            Loading levels…
          </span>
        )}
      </Row>
      <Row row="loadFile" label="Your level" focused={focusedRow === "loadFile"}>
        <LevelImportControl
          report={library.report}
          onFile={onFile}
          onDismiss={library.dismissReport}
          pickerRef={pickerRef}
        />
        {selectedLevel?.memory && (
          <RememberedLevelActions entry={selectedLevel} library={library} onFind={onLoad} />
        )}
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
