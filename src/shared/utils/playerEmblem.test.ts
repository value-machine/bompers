import { describe, expect, it } from "vitest";
import { PLAYER_EMBLEM_GLYPHS, playerEmblemShape } from "@/shared/utils/playerEmblem";

describe("playerEmblem", () => {
  it("should give each of the four slots its own shape kind or outline when asked", () => {
    const shapes = [0, 1, 2, 3].map((slot) => playerEmblemShape(slot, 10));
    expect(shapes.map((s) => s.kind)).toEqual(["circle", "polygon", "roundRect", "polygon"]);
    expect(shapes[1]).not.toEqual(shapes[3]);
    expect(PLAYER_EMBLEM_GLYPHS).toEqual(["●", "▲", "■", "✚"]);
  });

  it("should repeat the emblems from slot 4 on when there are more slots", () => {
    expect(playerEmblemShape(4, 10)).toEqual(playerEmblemShape(0, 10));
  });

  it("should scale with the size argument when drawn larger", () => {
    expect(playerEmblemShape(0, 20)).toEqual({ kind: "circle", radius: 20 });
  });
});
