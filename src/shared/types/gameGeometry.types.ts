/** World-space geometry shared by the game features. Units: world units, y grows downward. */
export interface Vec2 {
  x: number;
  y: number;
}

/** Axis-aligned rectangle; `x`,`y` is the top-left corner. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Circle {
  x: number;
  y: number;
  radius: number;
}
