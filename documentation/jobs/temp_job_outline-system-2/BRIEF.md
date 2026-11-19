# Brief — Outline system, lap 2: fills and lips from the field

Task: approach B, lap 2 (`temp_job_outline-system/BRIEF.md` § Laps; owner pick B, 2026-11-19) plus "where a pillar meets a horizontal rectangle the seam should show and read like one shape … one continuous wall" (owner, 2026-11-18) · Lap: temp_job_outline-system-2 · Harness: v0.45.0 · Base: main ca5f0b7 (#95)

## Problem

The outline treats touching shapes as one (and since #94 the field's joins are square), but the fills do not. Each slab is filled as its own rounded rect with its own lip. Where a pillar meets a slab the ink shows as a notch on each side, the pillar's lip sits inside the wall and the floor's lip runs through the pillar's foot. Breakable fills are still drawn through a stencil mask.

## Success check

Slabs of one colour that touch are one fill with no notch or line at the seam. The lip is a lighter band right on every edge that faces up into the air, following rounded corners, also on crater rims, burnt edges and thin platforms, and absent where another shape sits on top (owner pick 3 on the options page, replacing a first pick of 1). Two colours touching leave no gap. Craters and burn-outs cut fills and lips as before. No layer of the terrain view has a mask.

## In scope

- Fills from the field: one layer per material + colour slot, painted in slot order (`slotLayerRegion`).
- Lips from the field (`belowLipRegion`): each slot layer in its lip colour, then its fill colour where the sample above is terrain too.
- The stencil mask, `drawSlabFill` and `breakableRegion` removed; a slot's layer is redrawn only when the dirty chunks are near its box.
- Tests, arena README, DESIGN_LANGUAGE § 2 and § 5.

## Out of scope

- Will NOT do: fire body, frost, stains, the grow cap, prop widths (lap 3). The ice inner rim per joined shape (still per authored piece).
- Will NOT touch: the distance field, collision, `src/config/app-tasks.json`.

## Edges

| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| `arena` | authored rounded rects + lips; breakable ones under a stencil mask | `terrainSurfaces.ts` (regions, lips), `terrainRenderer.ts` (slab layers), `findSlot`, `shiftShape` export | ride |
| `documentation/game` | § 2 slab and lip wording, § 5 layer order | two sentences | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size

M by look risk, S by files: one feature, no new files in `src/`.

## Plan

Conflict & compliance: architecture (arena only), code-style F2 (the slot lookup is one helper for raster and renderer; the part's shape shift is the raster's, exported), file budget unchanged, game-juice "owner picks first" (lip look picked on the options page, D7), code-style F2 (the lip cut is the second copy of frost's `underLip`; marked, to be joined in lap 3 when frost moves to the builder).

1. Tests first: inner corners filled, no gap between two colours, crater cuts the fill; the band on the wall of the options page (open tops yes, pillar and under its foot no), round the corner, on a thin platform, on a crater rim, none under another colour; no masked layer; a far slot is not redrawn.
2. `slotLayerRegion` / `slotLayerBoxes`, `belowLipRegion`, `drawSlabDetails`.
3. `terrainRenderer.ts`: slab layers per body in the body's own grid coordinates; dirty box from the dirty chunks.
4. Docs.

Gate: type-check, lint, arch:check, validate:structure, validate:feature-size, validate:feature-docs, full test run, one headless smoke.

Acceptance tests: `src/features/arena/services/terrainSurfaces.test.ts` › "slab fills from the field", "belowLipRegion", "terrain view without a clip mask".

## Notes during development

- A fill per slot alone (each slot ending at its own samples) left a wedge of half a sample open where two colours meet at the terrain's edge: each slot's contour rounds that corner. Hence layers (D8).
- Headless smoke (fire-test-level, 900 frames burning and cratering; crusher level, 120 frames): no console errors, no ink spikes, visible terrain ink 4,542 px at rest (lap 1: 4,608). `renderGame` on the CPU averaged 9.4 ms a frame through the fire (no baseline taken on main).
- The lap was first built with lip pick 1 (pills on open tops, pushed as ec0df33); the owner's correction to pick 3 arrived during the build and replaced it. The headless smoke ran on the pick 1 build; the lip change is geometry only and was not smoked again.
- Look changes to check on the preview: the lip is now a band on the edge (new look for all terrain); slab corners and circle or polygon pieces are now filled in the field's shape (as their outline and collision already were), not the authored shape.
- Not verified: the look on a real screen, levels with polygons or circles, ice slabs that touch.
