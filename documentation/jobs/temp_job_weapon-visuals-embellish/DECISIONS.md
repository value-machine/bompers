# Decisions — weapon-visuals-embellish

Job: `temp_job_weapon-visuals-embellish`
Updated: 2026-11-18

Design page (owner picked round by round): https://claude.ai/artifact/Cnyu1t1xJ79irmeyRRcYri

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D1 | Where the barrel starts | closed | The centre of the helmet; its start is never visible; works through 360°, also aiming down | loop-refine | owner 2026-11-17: "The muzzle start should be the center of the helmet and i want to not see the start-end". Supersedes the off-centre pivot of weapon-visuals. |
| D2 | Helmet and barrel colour | closed | One unified flat cream for helmet and barrel; no helmet gradient | loop-refine | owner 2026-11-18: "base muzzle color and the helmet to be one unified color"; picked "flat cream" over a shared soft shade. Supersedes DESIGN_LANGUAGE § 3 helmet shading. |
| D3 | Barrel shape | closed | Tapered: wide at the helmet, narrower at the mouth | loop-refine | owner 2026-11-18, over straight and chunky |
| D4 | Barrel and eyes | closed | Barrel is drawn on top of the eyes; the eyes do not make room | loop-refine | owner 2026-11-18: "It should be on top of the eyes", "It's fine if they are covered" |
| D5 | Shot animation | closed | Squash pop of the barrel (0.78 × 1.22, 0.2 s) | loop-refine | owner delegated: "what would be most extensible for different muzzle shapes"; agent-pick: one scale on the whole barrel fits any mouth shape |
| D6 | Barrels per weapon | closed | Always one barrel; the mouth tells the weapon | loop-refine | owner 2026-11-18: "It's just one missile, so should have one barrel". Supersedes the twin-pod silhouette (weapon-visuals D1). |
| D7 | Weapon cue at the mouth | closed | Accent mouth: only the mouth parts take the weapon accent and are the ready light (pale while recharging) | loop-refine | owner 2026-11-18, over shape-only and loaded. Supersedes the muzzle dot (weapon-visuals D3, light part). |
| D8 | Mouth per weapon | closed | Rocket: lip. Homing: lip + two fins swept back toward the helmet. Torch: funnel (flame from the fire layer). Freeze ray (after #63): wide dish + knob | loop-refine | owner picked fins "but the other way"; freeze shape follows #63's emitter dish |
| D9 | Crate | closed | Colour block: whole crate in the weapon accent, the weapon's mouth centred in ink with a white outline; no cream face, no ring, no window | loop-refine | owner 2026-11-18. Supersedes the cream crate with accent ring (weapon-visuals D1, crate part). |
| D10 | Gloss on the crate | closed | One white gloss oval on the crate, like the blob's | loop-build | owner 2026-11-18, mid-build: "I do want a gloss mark on the weapon pickups". Exception to "pickups stay flat" (DESIGN_LANGUAGE § 3). |

## Open

| id | topic | status | options briefly | blocked phase |
|----|-------|--------|-----------------|---------------|

## Log

- 2026-11-18 — D1–D9 closed via loop-refine (asked on the design page; D5 agent-pick on the owner's delegation)
