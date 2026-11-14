import { Container, Graphics, Text, type Application } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import {
  createTerrainView,
  syncTerrainView,
  type TerrainView,
} from "@/features/arena/api/arenaApi";
import {
  createPlayersView,
  syncPlayersView,
  type PlayersView,
} from "@/features/player/api/playerApi";
import {
  applyCameraView,
  computeCameraView,
  type CameraView,
} from "@/features/camera/api/cameraApi";
import type { GameState } from "@/features/match/services/gameSim";

/**
 * Composes the render layers. Scene graph:
 *   stage
 *   ├─ world   (camera transform; world units)
 *   │  ├─ backdrop (level area)
 *   │  ├─ terrain  (arena)
 *   │  ├─ players  (player)
 *   │  └─ (combat effects — reserved)
 *   └─ hud     (screen units: round timer)
 * Each feature owns its layer's create/sync pair; this file only orders and drives them.
 */
export interface GameRenderer {
  world: Container;
  terrain: TerrainView;
  players: PlayersView;
  timer: Text;
  camera: CameraView | null;
}

export function createGameRenderer(app: Application, state: GameState): GameRenderer {
  const world = new Container({ label: "world" });
  const { level } = state.arena;
  const backdrop = new Graphics()
    .rect(0, 0, level.widthCells * level.cellSize, level.heightCells * level.cellSize)
    .fill(GAME_PALETTE.outOfBounds);
  const terrain = createTerrainView(state.arena.terrain);
  const players = createPlayersView();
  world.addChild(backdrop, terrain.container, players.container);

  const hud = new Container({ label: "hud" });
  const timer = new Text({ text: "", style: { fill: GAME_PALETTE.hudText, fontSize: 28 } });
  timer.anchor.set(0.5, 0);
  hud.addChild(timer);

  app.stage.addChild(world, hud);
  return { world, terrain, players, timer, camera: null };
}

const formatClock = (seconds: number): string => {
  const whole = Math.ceil(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

/** Draws the latest state (no interpolation, lap D6). Call once per rendered frame. */
export function renderGame(
  renderer: GameRenderer,
  frame: { state: GameState; app: Application; dt: number }
): void {
  const { state, app, dt } = frame;
  const viewport = { width: app.screen.width, height: app.screen.height };
  const { level } = state.arena;

  syncTerrainView(renderer.terrain, state.arena.terrain);
  syncPlayersView(renderer.players, state.players);

  renderer.camera = computeCameraView({
    targets: state.players.map((player) => ({ x: player.x, y: player.y })),
    bounds: {
      x: 0,
      y: 0,
      width: level.widthCells * level.cellSize,
      height: level.heightCells * level.cellSize,
    },
    viewport,
    previous: renderer.camera,
    padding: state.tunables.camera.padding,
    dt,
  });
  applyCameraView(renderer.world, renderer.camera, viewport);

  renderer.timer.text =
    state.round.phase === "ended" ? "Time!" : formatClock(state.round.remainingSeconds);
  renderer.timer.position.set(viewport.width / 2, 12);
}
