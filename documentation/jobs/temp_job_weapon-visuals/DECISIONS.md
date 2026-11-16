# Decisions — weapon-visuals

Job: `temp_job_weapon-visuals`
Updated: 2026-11-16

Design page (owner reviewed): https://claude.ai/artifact/HLh5EfKdMC2WWHyPwBHcSh

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D1 | What signals the weapon | closed | A: tube silhouette per weapon on the helmet + accent cap; crate face shows the same silhouette in an accent ring | loop-refine | owner via orchestrator; over B (helmet badge icon) and C (colour only). Helmet keeps the player emblem. |
| D2 | What signals a team | closed | light cream vs dark plum helmet shell; built when team mode exists | loop-refine | owner via orchestrator |
| D3 | Ammo display | closed | HUD slot: ammo bar right under the health bar, same pill design, in the weapon accent colour (colour = weapon). Accent muzzle light on the tube fades out while a shot recharges, full when ready. No empty-weapon visual: the tube disappears at 0 ammo | loop-refine | owner's own answer, verbatim in orchestrator message 2026-11-16 |
| D4 | Lap scope | closed | crates + tube system + HUD ammo now; team helmets later | loop-refine | owner via orchestrator |
| D5 | Weapon accents | closed | rocket sky `#8fd6ff`, homing lilac `#b08cff` (the ring #39 shipped; proposed `#b58cff`), flame ember `#ff8a1f`; never a player body colour | loop-refine | clear-winner: sky is today's crate ring; lilac/ember from the design page the owner reviewed |
| D6 | Homing missile look in flight | closed | lilac body + red blinking seeker light | homing lap | owner passed #39 with this look (orchestrator, 2026-11-16) |
| D8 | Ammo row shape | closed | pills, one per shot, smaller to fit the health-row width | loop-refine | derived from the owner's D3 answer "same design [as health], just different color"; confirmed by orchestrator 2026-11-16 |
| D7 | Where per-weapon looks live | closed | `weaponLooks[itemId]` in `shared/config/gamePalette.ts` | loop-refine | clear-winner: palette is the existing home for looks (`materialLooks`), read by collectibles, player and match without cross-feature imports |

## Open

| id | topic | status | options briefly | blocked phase |
|----|-------|--------|-----------------|---------------|

## Log

- 2026-11-16 — D1–D4 closed via loop-refine (asked, owner through orchestrator)
- 2026-11-16 — D5, D7 closed via loop-refine (clear-winner)
- 2026-11-16 — D6 closed (owner passed #39's homing look)
