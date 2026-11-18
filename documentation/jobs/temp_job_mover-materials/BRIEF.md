# Brief — Mover materials (draft, waits for D1)

Task: beams stop on moving parts; parts take their material's fire and ice · Lap: temp_job_mover-materials · Harness: v0.45.0

## Problem

The torch's flame and the freeze ray pass through moving parts, and a part of any material acts like stone: it never burns, freezes or breaks. The owner wants parts to be any material, on an extensible system, and asked for approaches of increasing depth before any code.

## Success check

Pending D1. For the recommended approach 3, lap 1: with a part between a spraying blob and a wall, no ray of the fan ends past the part, and the blob behind the part is not lit, chilled or pushed.

## In scope

- This lap: the options page with four approaches and the owner's pick (D1). No game code.
- After the pick: a plan cut into laps of size M or smaller (the page's cut for approach 3 is the starting point).

## Out of scope

- Will NOT do: game code before D1.
- Will NOT touch: `src/config/app-tasks.json`; the beam-clash rule (PR #75) beyond agreeing the landing order on `src/shared/utils/rayFan.ts`.

## Edges

Found in the code at v0.45.0 (grounding for the page):

| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| `shared/utils/rayFan` | `castRayFan` reads the static grid's `cells` only, so rays miss parts | a world hit that names the body and the sample | ride (also edited by beam-clash) |
| `arena` | a part's `field` is a full `TerrainGrid` (slots with `burns`, `douses`, `toughness`; `frozen`); solid queries see parts; `clearCrater`, `burnOut` run on the static grid | the list of bodies; grip per sample on parts; part drawing cut by its field | ride |
| `fire`, `ice` | state sized to the one static grid (`createFireState(grid)`, `createIceState(grid)`) | state per body | ride |
| `knockout` | stains already store field + rest pose (`rides.mover`) | first user of the shared body lookup | ride |
| `content-catalog` | `burns`, `douses`, `toughness` flags per material | reactions as data (approach 3, lap 3) | ride |
| `level-file`, `level-kit`, LEVEL_FORMAT § 11 | W13: a breakable material in a part acts unbreakable; prompt says parts never break | W13 and one prompt line change from approach 2 up | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size

This lap: S (page + pick). The work behind it: S for approach 1, M + M for 2, about five laps of S–M for 3.

## Decisions

DECISIONS.md: D1 open (owner pick on the options page).
