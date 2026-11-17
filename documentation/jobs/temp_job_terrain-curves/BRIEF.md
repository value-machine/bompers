# Brief — Curved terrain edges

Task: Fire work lap a2r (orchestrator run `run:bompers-game-2`, thread `fire-design`) · Lap: temp_job_terrain-curves · Harness: v0.45.0
Carries: blast-power D18 (owner: "field with real curves"; untouched authored shapes stay sharp), terrain-field D2–D10 (#45).

## Problem
Craters still draw as 4-unit staircases: breakable slabs are clipped by a mask of square sample runs, although every sample now stores an exact distance to the edge.

## Success check
After a blast, a breakable slab is clipped exactly along the crater rim (the mask's coverage matches `distance > 0` to within half a unit at any point near the rim), while a slab no blast has touched keeps its authored sharp corners (its mask covers the whole authored shape).

## In scope
- Desk spike shader vs contour → contour (DECISIONS D1).
- Mask builder: untouched cells → rect runs; cells a blast touched → contour pieces from the distance field (marching squares, linear crossings); the ink mask is the same contour grown by the ink width.
- Renderer uses it; tiles / seams / cracks unchanged.
- Docs: arena README, DESIGN_LANGUAGE crater wording.

## Out of scope
- Will NOT do: ink line along crater rims (DESIGN_LANGUAGE keeps "no ink on crater edges"), collision on the distance (a3), air-side re-measuring beyond what drawing needs, fire.
- Will NOT touch: sim, level format, unbreakable slab drawing.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| arena | `drawBreakableMasks` rect runs of standing breakable cells; `syncTerrainView` redraws masks on dirty | contour mask builder in `terrainSurfaces.ts`; view keeps the load-time distances | ride |
| documentation/game | DESIGN_LANGUAGE "craters cut stepped edges" | curved crater edges; breakable = plain slab (D5) | ride |
| player (Change verdict) | axis-separated move, no step-up | grounded step-up + snap-down (D6), tunable `player.stepUp` | ride |
| content-catalog, level-kit, shared types (Change verdict) | earth / cardboard `surface: "breakable"` (seam grid) | `"plain"`; kit notes / prompt / preview wording | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size
S — one pure mask builder (TDD) and its use in the renderer.

## Decisions
DECISIONS.md.
