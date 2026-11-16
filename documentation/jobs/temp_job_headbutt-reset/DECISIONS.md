# Decisions — headbutt-reset

Job: `temp_job_headbutt-reset`
Updated: 2026-11-16

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D1 | How a level places it | closed | Catalog item `dive-reset` on the existing `collectible` role | loop-refine | clear-winner: additive catalog ID, no new role, no format bump (LEVEL_FORMAT § 8); generators already know the role. Alternative new `pickup` role rejected (format change for no gain). |
| D2 | When it is taken | closed | Only by a player whose dive charge is spent; a charged player passes through | loop-refine | clear-winner: owner text "when the charge is spent"; Celeste refill-crystal precedent; prevents griefing a route by grabbing it early. |
| D3 | Respawn | closed | Shared pickup, gone for `respawnSeconds` 2.5 s after use, then back at the same point; ghost outline while gone | loop-refine | clear-winner: Celeste crystal (~2.5 s); fixed point, no falling (unlike orbs), present from round start. |
| D4 | What it restores | closed | The charge, and the between-dives cooldown is waived: the next dive is ready once the current recovery ends | loop-plan (amended after plan review) | First draft kept the cooldown; review showed 0.7 s free fall (~340 u) per link, which breaks the owner's chain goal. Same as the hit ricochet, which already zeroes the cooldown. |
| D7 | Code name | closed | `diveRefill*` in code, catalog ID `dive-reset` | loop-plan | Naming F1: avoids confusion with `resetDive` (respawn wipe); the ID keeps the owner's word for level authors. |
| D8 | Look | closed | Aqua `#5fe0ff` diamond crystal + ink up-chevron, ghost outline while gone | loop-build | Not a player hue (DESIGN_LANGUAGE § 1); shape is the first cue. Owner judges on the preview. |
| D5 | Sound | closed | Reuse `pickup`, pitched by the collector | loop-refine | clear-winner: orchestrator brief — no new audio without the owner's listen-first. |
| D6 | Juice tier | closed | `light` (own action: pick up) | loop-refine | GAME_JUICE § 2 table. |

## Log

- 2026-11-16 — D1–D6 closed via loop-refine (clear-winner)
