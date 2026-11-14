import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE, playerColors } from "@/shared/config/gamePalette";
import type { PlayerState } from "@/features/player/types/player.types";

/**
 * Player render layer: one display object per player id, created on first sight and removed
 * when the player leaves the state. Placeholder box (player color, ink outline) with a helmet notch on the facing side; the
 * movement lap swaps in the blob body, squash and feet.
 */
export interface PlayersView {
  container: Container;
  sprites: Map<string, Graphics>;
}

export const createPlayersView = (): PlayersView => ({
  container: new Container({ label: "players" }),
  sprites: new Map(),
});

function drawPlayer(player: PlayerState): Graphics {
  const { body } = playerColors(player.slot);
  const { width, height } = player;
  return new Graphics()
    .rect(-width / 2, -height, width, height)
    .fill(body)
    .stroke({ color: GAME_PALETTE.ink, width: 3 })
    .rect(width / 2 - 7, -height + 5, 5, 9)
    .fill(GAME_PALETTE.helmet);
}

/** Matches the layer to the current players. Call once per rendered frame. */
export function syncPlayersView(view: PlayersView, players: readonly PlayerState[]): void {
  const seen = new Set<string>();
  for (const player of players) {
    seen.add(player.id);
    let sprite = view.sprites.get(player.id);
    if (!sprite) {
      sprite = drawPlayer(player);
      view.sprites.set(player.id, sprite);
      view.container.addChild(sprite);
    }
    sprite.position.set(player.x, player.y);
    sprite.scale.x = player.facing;
  }
  for (const [id, sprite] of view.sprites) {
    if (seen.has(id)) continue;
    sprite.destroy();
    view.sprites.delete(id);
  }
}
