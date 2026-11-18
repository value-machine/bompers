# Brief — Mover materials, lap 3: reactions as data (draft, with the orchestrator)

Task: what happens when an element meets a material, and when two elements meet, comes from tables (owner pick, route D1: `temp_job_mover-materials/DECISIONS.md`) · Lap: temp_job_mover-materials-l3 · Harness: v0.45.0

## Problem

How a material reacts to fire and cold is spread over two booleans and rules derived from them in five places: `burns` and `douses` in the content catalog, "scorches" derived as "does not burn and has a toughness" in the fire sim, "cold cannot enter" derived as `douses` in the ice sim, "ice puts a burning blob out" as `douses` in blob-fire, and the W13 warning as "has a toughness and does not burn". A new material must be read against all five; a new element has no place to say what it does to each material. The beam clash has its own pair table with its own element type.

## Success check

Behaviour is unchanged: every existing test passes with only its fixtures' field names changed. Each material states its reaction to each element in one catalog row, and the five places read that row. One element ID type is shared by beams, materials and the pair table. Proof of the extensibility claim, as tests: a metal material added in a test catalog (blocks fire, takes cold) needs no sim change; an element pair added to the pair table makes two beams of those elements clash with no change to the clash rule.

## In scope

- `shared`: one element ID type (`fire`, `cold`) and the element pair table (fire × cold cancel), which the beam clash reads. `BeamElement` and the clash's own table go.
- `content-catalog`: `MaterialEntry.reactions`: per element, what the material does. Fire: `burns` (cardboard), `scorches` (earth), `blocks` (stone), `douses` (ice). Cold: `freezes` (stone, earth, cardboard), `blocks` (ice). `burns` / `douses` go. `toughness` stays as it is: it is already data and a number, not a kind of reaction.
- `arena`: a cell slot carries the material's reactions instead of the two flags.
- Readers: fire sim (catch, scorch, douse), ice sim (what carries cold), blob-fire (ice next to a burning blob), level-file (W13), level-kit (catalog export, prompt facts), combat (a beam's element).

## Out of scope

- Will NOT do: a generic element engine. Fire and cold keep their own sims (they already share the front, the ray fan and the body list); the table says what a material does, the sim says how.
- Will NOT do: a new element or material in the game (acid and metal exist only as test fixtures).
- Will NOT do: the frozen state as data. Frozen ground "acts like ice" in the arena's own queries (grip, craters, fire); that rule stays where it is.
- Will NOT touch: tunables, looks, sounds, the player controller and roll, `src/config/app-tasks.json`.

## Edges

| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| `shared` (`beamClash`, types) | `BeamElement`, own `REACTIONS` table | `ElementId`, `elementPairs` | ride (rename + move, code-style F3) |
| `content-catalog` | `burns`, `douses` on `MaterialEntry` | `reactions` | ride |
| `arena` | slot copies `burns`, `douses` | slot copies `reactions` | ride |
| `fire`, `ice`, `blob-fire` | read the flags and derive | read the reaction | ride |
| `level-file` | W13 from toughness + `burns` | W13 from the fire reaction | ride |
| `level-kit` | exports `burns` / `douses` in `catalog.json`; prompt facts | exports `reactions`; prompt facts from them | ride |
| `combat` | `sprayBeamOf` names `BeamElement` | names `ElementId` (`ice` → `cold`) | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size

M by reach (eight areas, each a small change); no new behaviour.

## Decisions

| id | topic | status | choice / options |
|----|-------|--------|------------------|
| D1 | Shape of the material × element table | proposed (agent) | A row per material in the catalog with one reaction word per element, as above. Not a separate matrix file: the catalog is where a material is defined, and the kit's `catalog.json` is generated from it |
| D2 | Element IDs | proposed (agent) | `fire` and `cold`. `cold` is the element; `ice` stays the material and the frozen look. The beam clash's `ice` becomes `cold` |
| D3 | Pair table | proposed (agent) | One shared table keyed by element ID, one reaction today: fire × cold `cancel`. The beam clash reads it; its "steam" stays the look of a cancel between beams. The ground and blob rules (fire stops at frost, the torch thaws, a chilled burning blob goes out) stay coded in their features and are named in the table's comment as the meanings of `cancel` there |
| D4 | The kit's `catalog.json` | open — for the orchestrator | It exports `burns` and `douses` per material today. Recommended: replace them with `reactions` (the file is generated; the kit's own preview does not read these fields; compatibility was waived for format 2). Alternative: keep exporting the two old fields beside `reactions` |
| D5 | How much the owner must see | open — for the orchestrator | Nothing changes in play, so there is no owner test beyond "fire, frost and the beam clash work as before". Recommended: merge on green like the blob-fire split |
