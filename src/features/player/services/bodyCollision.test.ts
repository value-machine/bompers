import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES, type GameTunables } from "@/shared/config/gameTunables";
import { buildTerrainFromLevel } from "@/features/arena/api/arenaApi";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { resolveBodyContacts } from "@/features/player/services/bodyCollision";
import { createPlayer } from "@/features/player/services/playerController";
import type { PlayerState } from "@/features/player/types/player.types";

// Cell size 8. Floor top at y = 320; a wall x 400–416 from y 0 to the floor.
const level: LevelDefinition = {
  formatVersion: 1,
  meta: { levelId: "t", title: "T" },
  settings: { cellSize: 8, gravity: 1 },
  worldSize: { w: 800, h: 400 },
  terrain: [
    { shape: { type: "rect", x: 0, y: 320, w: 800, h: 32 }, role: "platform", materialId: "stone" },
    { shape: { type: "rect", x: 400, y: 0, w: 16, h: 320 }, role: "platform", materialId: "stone" },
  ],
  spawns: [],
  drops: [],
  collectibles: [],
  bounds: { x: 0, y: 0, w: 800, h: 400 },
};
const terrain = buildTerrainFromLevel(level);
const T = DEFAULT_GAME_TUNABLES;
const E = T.bodyCollision.restitution;

const withBody = (patch: Partial<GameTunables["bodyCollision"]>): GameTunables => ({
  ...T,
  bodyCollision: { ...T.bodyCollision, ...patch },
});

/** A blob in mid-air (y 200), so the floor plays no part unless a test puts it there. */
const blob = (slot: number, x: number, patch: Partial<PlayerState> = {}): PlayerState => ({
  ...createPlayer(slot, { x, y: 200 }, T),
  ...patch,
});

const resolve = (players: PlayerState[], tunables: GameTunables = T) =>
  resolveBodyContacts({ players, terrain, tunables });

describe("resolveBodyContacts", () => {
  it("should reflect both blobs equally and oppositely when they meet head-on at the same speed", () => {
    const a = blob(0, 100, { vx: 500 });
    const b = blob(1, 120, { vx: -500 });
    const contacts = resolve([a, b]);
    expect(contacts).toHaveLength(1);
    expect(a.vx).toBeCloseTo(-500 * E);
    expect(b.vx).toBeCloseTo(500 * E);
    expect(a.vx).toBeCloseTo(-b.vx);
    expect(a.vy).toBe(0);
    expect(b.vy).toBe(0);
  });

  it("should swap the velocities when restitution is 1", () => {
    const a = blob(0, 100, { vx: 600 });
    const b = blob(1, 120, { vx: -200 });
    resolve([a, b], withBody({ restitution: 1, maxImpulse: 5000 }));
    expect(a.vx).toBeCloseTo(-200);
    expect(b.vx).toBeCloseTo(600);
  });

  it("should hand the momentum to a stationary blob and keep the total when one is moving", () => {
    const a = blob(0, 100, { vx: 600 });
    const b = blob(1, 120);
    resolve([a, b]);
    expect(b.vx).toBeCloseTo(((1 + E) / 2) * 600);
    expect(a.vx).toBeCloseTo(((1 - E) / 2) * 600);
    expect(a.vx + b.vx).toBeCloseTo(600);
  });

  it("should push along the contact normal when the hit is off-centre", () => {
    const a = blob(0, 100, { vx: 600 });
    const b = blob(1, 116, { y: 188 });
    resolve([a, b]);
    expect(b.vx).toBeGreaterThan(0);
    expect(b.vy).toBeLessThan(0);
    expect(a.vy).toBeGreaterThan(0);
    expect(a.vx + b.vx).toBeCloseTo(600);
    expect(a.vy + b.vy).toBeCloseTo(0);
  });

  it("should cap the velocity change when the closing speed is extreme", () => {
    const a = blob(0, 100, { vx: 4000 });
    const b = blob(1, 120);
    resolve([a, b]);
    expect(b.vx).toBeCloseTo(T.bodyCollision.maxImpulse);
    expect(a.vx).toBeCloseTo(4000 - T.bodyCollision.maxImpulse);
  });

  it("should share the speed without a bounce when the closing speed is below the resting speed", () => {
    const a = blob(0, 100, { vx: 100 });
    const b = blob(1, 120);
    resolve([a, b]);
    expect(a.vx).toBeCloseTo(50);
    expect(b.vx).toBeCloseTo(50);
  });

  it("should leave velocities alone but still report the contact when the blobs move apart", () => {
    const a = blob(0, 100, { vx: -300 });
    const b = blob(1, 120, { vx: 300 });
    const [contact] = resolve([a, b]);
    expect(contact?.impulse).toBe(0);
    expect(contact?.aApproachSpeed).toBeCloseTo(-300);
    expect(a.vx).toBe(-300);
    expect(b.vx).toBe(300);
  });

  it("should separate the blobs to touching distance when they overlap", () => {
    const a = blob(0, 100);
    const b = blob(1, 120);
    resolve([a, b]);
    expect(b.x - a.x).toBeCloseTo(a.width);
  });

  it("should bounce the falling blob off one standing on the ground", () => {
    const standing = blob(0, 100, { y: 320, grounded: true });
    const falling = blob(1, 100, { y: 320 - 24, vy: 500 });
    resolve([standing, falling]);
    expect(falling.vy).toBeCloseTo(-500 * E);
    expect(standing.vy).toBe(0);
    expect(standing.y).toBe(320);
    expect(falling.y).toBeCloseTo(320 - 28);
  });

  it("should not push a blob into terrain when separating next to a wall", () => {
    const atWall = blob(0, 386, { vx: 0 });
    const pusher = blob(1, 366, { vx: 400 });
    resolve([atWall, pusher]);
    expect(atWall.x + atWall.width / 2).toBeLessThanOrEqual(400);
  });

  it("should report no contact when the blobs do not touch", () => {
    expect(resolve([blob(0, 100), blob(1, 129)])).toHaveLength(0);
  });
});
