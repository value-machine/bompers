/**
 * World-space geometry shared by the game features. Units: world units (1 world unit = 1 SVG
 * unit in level files), origin top-left, y grows downward.
 */
export interface Vec2 {
  x: number;
  y: number;
}

/** Axis-aligned rectangle; `x`,`y` is the top-left corner. Same field names as level files. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Circle {
  x: number;
  y: number;
  radius: number;
}
