# Decisions — element-overlay-shape

Job: `temp_job_element-overlay-shape`
Updated: 2026-11-18

## Closed

| id  | topic                                                 | status | choice                                                                                                                                                   | source      | notes                                                                                                                                                                                                                                                     |
| --- | ----------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | How burning and frozen ground get the terrain's shape | closed | C: draw the state with the terrain's own contour code, limited to the state's samples                                                                    | loop-refine | Owner, 2026-11-18 ("C by far!"), options page https://claude.ai/artifact/PhbxM4HmnA9yWHLoDX74ox. Rejected: A clip the row pieces to the terrain; B stain the terrain's fill; D round only outer corners                                                   |
| D2  | Shared mechanism and its name (code-style F1–F3)      | closed | `SampleRegion` option on `terrainContour`, with `markedRegion` (a set of samples) and `breakableRegion`; lives in the arena, exported through `arenaApi` | loop-plan   | clear-winner: breakable, burning and frozen are three cases of "terrain limited to some samples"; `breakableOnly` was the first consumer's name. Rejected: a second contour in shared (two copies of the march); a mask per layer (a clip pass per frame) |
| D3  | The edge inside the terrain                           | closed | A marked sample is always inside, an unmarked solid one never; the edge between them shifts with the share of marked neighbours, so it is a curve        | loop-plan   | agent-pick. Rejected: neighbour share alone (a fresh fire of one to four samples would be invisible)                                                                                                                                                      |
| D4  | When the layers are redrawn                           | closed | On `fire.version` / `frozenVersion`, the new `TerrainGrid.shapeVersion`, the outline width; fire's hot inside four times a second. Only flames per frame | loop-plan   | clear-winner (performance rule: no contour per frame). `shapeVersion` because the terrain view consumes `dirtyChunks`                                                                                                                                     |
| D5  | Ice lip                                               | closed | One sample (4 units) deep: the frozen contour without its top sample row, drawn over the whole shape in the lip colour                                   | loop-build  | agent-pick; was 0.4 block (3.2 units). No mask needed                                                                                                                                                                                                     |

## Log

- 2026-11-18 — D1 asked on the options page, closed by the owner in chat
- 2026-11-18 — D2–D5 closed (clear-winner / agent-pick)
