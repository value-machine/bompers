# Brief — Level import warns on items in the wrong role

Task: Level import warns on items in the wrong role · Lap: temp_job_import-role-warnings · Harness: v0.45.0

## Problem
A level file can put a catalog item on the wrong point role (`data-item="rocket-launcher"` on a collectible, `data-items="dive-reset"` on a drop); the importer accepts it silently and the game runs an item where its role can't use it. Unknown IDs already warn (W4); the role mismatch does not.

## Success check
`parseLevelFile` on a level with `data-items="dive-reset"` on a drop and `data-item="rocket-launcher"` on a collectible returns `ok: true` with one W11 warning per wrong-role ID, the drop falling back to the default drop items and the collectible to the default collectible; the kit preview lists the same mismatch.

## In scope
- Content catalog: one lookup for "is this ID an item of this use" (`ItemEntry.use` stays the single source of role membership).
- Importer (`level-file`): new warning **W11 — item ID on the wrong role**; same fallback as W4 (drop: left out, default drop items when none remain; collectible: default collectible). Warning, never an error (the level stays playable through the fallback).
- Kit preview (`public/level-kit/v2/preview.js`): flags a known item whose `use` doesn't match the role (reads `use` from `catalog.json`).
- Docs: LEVEL_FORMAT § warnings table (W11) and the W4 row wording; `pnpm level-kit:check` stays green (sync if the generated prompt/ID tables change).

## Out of scope
- Will NOT do: role checks in `level` normalisation of built-in (code) levels — those are typed and tested; deferred unless a second need shows.
- Will NOT touch: arena / terrain renderer (parallel lap), engine item behaviour, the format version (W11 is additive).

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| content-catalog | `hasCatalogEntry(kind, id)`; `ItemEntry.use` | new `itemUseOf(id)` in `contentCatalog.ts` + api | ride |
| level-file | `readDropItems` / `readCollectibleItem` → `checkRef` W4 | role check after the catalog check in `levelFileElements.ts`; `LevelWarningCode` + W11 | ride |
| level-kit (public kit) | `preview.js` `validate()` item loop | add use mismatch | ride |
| documentation/game | LEVEL_FORMAT § 8 warnings | W11 row | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size
S — three areas ride existing hook points; no refactor.
Cut into laps: none

## Decisions
DECISIONS.md D1–D3.
