import type { Container } from "pixi.js";

/**
 * Keeps one display object per key in `sprites` (render layers of entities that come and go:
 * rockets, weapon crates, orbs, effects): creates missing ones, places all, destroys stale ones.
 * Keys can carry a look version (for example `${id}:${outlineStep}`) so a sprite is rebuilt when
 * its look changes.
 */
export function syncDisplayById<K, T>(
  sprites: Map<K, Container>,
  parent: Container,
  items: {
    list: readonly T[];
    key: (item: T) => K;
    create: (item: T) => Container;
    place: (sprite: Container, item: T) => void;
  }
): void {
  const seen = new Set<K>();
  for (const item of items.list) {
    const id = items.key(item);
    seen.add(id);
    let sprite = sprites.get(id);
    if (!sprite) {
      sprite = items.create(item);
      sprites.set(id, sprite);
      parent.addChild(sprite);
    }
    items.place(sprite, item);
  }
  for (const [id, sprite] of sprites) {
    if (seen.has(id)) continue;
    sprite.destroy({ children: true });
    sprites.delete(id);
  }
}
