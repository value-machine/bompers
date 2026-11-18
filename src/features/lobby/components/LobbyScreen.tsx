import { useRef } from "react";
import { useFileDrop } from "@/shared/hooks/useFileDrop";
import type { LevelFilePicker, LevelLibrary } from "@/features/level-file/api/levelFileApi";
import { droppedFileHandle } from "@/features/level-memory/api/levelMemoryApi";
import type { MatchSetup } from "@/features/match/api/matchApi";
import { useMusicTrack } from "@/features/sound/api/soundApi";
import type { Lobby } from "@/features/lobby/hooks/useLobby";
import { useLobbyInput, type DeviceActivity } from "@/features/lobby/hooks/useLobbyInput";
import type { LobbyAction } from "@/features/lobby/types/lobby.types";
import { InputIndicator, PlayerSlotCard } from "@/features/lobby/components/PlayerSlotCard";
import { LobbyMenu } from "@/features/lobby/components/LobbyMenu";

export interface LobbyScreenProps {
  lobby: Lobby;
  library: LevelLibrary;
  onStart: (setup: MatchSetup) => void;
}

const subtitle = (players: number): string => {
  if (players === 0) return "Press Space (left keys), Enter (right keys) or A (pad) to join.";
  if (players === 1) return "Test mode: one player. More can join any time before the start.";
  return `${players} players. Up / down picks a row, left / right changes it, join key confirms.`;
};

/**
 * The join screen before a round (GDD § 1, § 7): four player slots, the shared settings menu,
 * and a strip showing every input device the game hears. Fully keyboard and pad driven;
 * the pointer works too.
 */
export const LobbyScreen = ({ lobby, library, onStart }: LobbyScreenProps) => {
  const pickerRef = useRef<LevelFilePicker>(null);
  useMusicTrack("lobby");

  const run = (action: LobbyAction): void => {
    const effect = lobby.dispatch(action);
    if (effect === "pickFile") pickerRef.current?.open();
    if (effect !== "start") return;
    const setup = lobby.matchSetup();
    if (setup) onStart(setup);
  };
  const activity = useLobbyInput(run);

  const onFile = (file: File, handle?: FileSystemFileHandle): void => {
    void library.importFile(file, handle).then((id) => {
      if (id) lobby.dispatch({ type: "selectLevel", levelId: id });
    });
  };
  // A dropped file links too where the browser hands over its handle (Chrome, Edge).
  const { isDragging, dropHandlers } = useFileDrop((file, item) => {
    void droppedFileHandle(item).then((handle) => onFile(file, handle ?? undefined));
  });

  const { view } = lobby;
  const activityAt = (deviceIndex: number): DeviceActivity | null => activity[deviceIndex] ?? null;

  return (
    <div
      className="relative h-full w-full overflow-y-auto bg-background text-foreground"
      data-testid="lobby-screen"
      {...dropHandlers}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
        <header>
          <h1 className="text-3xl font-bold">Who's playing?</h1>
          <p className="text-muted-foreground">{subtitle(view.players)}</p>
        </header>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {view.slots.map((slotView) => (
            <PlayerSlotCard
              key={slotView.slot}
              view={slotView}
              activity={activityAt(slotView.deviceIndex)}
              onLeave={() => run({ type: "leave", slot: slotView.slot })}
            />
          ))}
        </div>
        <LobbyMenu
          lobby={lobby}
          library={library}
          pickerRef={pickerRef}
          onFile={onFile}
          onLoad={() => pickerRef.current?.open()}
          onAction={run}
        />
        <ul
          className="flex flex-wrap gap-3 text-xs text-muted-foreground"
          aria-label="Input devices"
        >
          {view.devices.map((device, index) => {
            const state = activityAt(index);
            const suffix =
              device.slot !== -1 ? ` (P${device.slot + 1})` : state?.present ? "" : " (none)";
            return (
              <li
                key={device.key}
                className="flex items-center gap-1"
                data-testid={`device-${device.key}`}
                data-present={state?.present ? "true" : "false"}
                data-active={state?.active ? "true" : "false"}
              >
                <InputIndicator activity={state} />
                {device.label}
                {suffix}
              </li>
            );
          })}
        </ul>
      </div>
      {isDragging && (
        <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-lg border-4 border-dashed border-primary bg-background/60 text-lg font-medium">
          Drop a level file to add it
        </div>
      )}
    </div>
  );
};
