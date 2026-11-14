import type { Graphics } from "pixi.js";
import type { EmblemShape } from "@/shared/utils/playerEmblem";

/** Adds `shape` to `g`'s current path (fill or stroke it after). */
export function traceEmblem(g: Graphics, shape: EmblemShape): Graphics {
  switch (shape.kind) {
    case "circle":
      return g.circle(0, 0, shape.radius);
    case "polygon":
      return g.poly([...shape.points]);
    case "roundRect":
      return g.roundRect(shape.x, shape.y, shape.width, shape.height, shape.radius);
  }
}
