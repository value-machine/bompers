# Decisions — crouch-sink

Job: `temp_job_crouch-sink`
Updated: 2026-11-19

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D1 | Crouch look | closed | "Sink + settle, low": rigid helmet, the blob's top shortens into the dome, jelly bulge under the rim (94 % area), drop onto and spread over the ground, settle wobble, breathing, hop on stand-up | loop-refine (asked, 4 option rounds) | owner rejected rounds 1 (shell variants) and 3 (foot variants): "nothing spills through the helmet", "sink lower, really cover a bit of the ground" |
| D2 | Feet while crouched | closed | vanish (shrink away in the first 60 ms) | loop-refine (asked) | "The feet can just disappear." |
| D3 | Gloss while crouched | closed | body gloss slides left onto the bulge's upper-left arc, along it | loop-refine (asked) | owner: "reflects the sky from that arc" |
| D4 | Hurt box while crouched | closed | moves down with the helmet: top at `hurtHeightScale` (0.6) × height; weapons fire from the lowered helmet | loop-refine (asked) | owner: "hitbox should also move down" |
| D5 | Helmet glint | closed | reshape a little so it stays well inside the dome | loop-refine (asked) | owner: "it spills off the helmet" |
| D7 | player feature file budget (services 10/10) | closed | waiver (`featureBudgets.config.cjs` overrides.player, 12 per layer) + follow-up task: move the blob drawing into its own feature | loop-plan (asked) | plan-review A1 |
| D6 | Sky-drop pickups | closed | keep the full body box this lap | loop-plan (clear-winner) | pickups are another thread's area; follow-up task |


## Log

- 2026-11-19 — D1–D5 closed via loop-refine (asked)
- 2026-11-19 — D6 closed via loop-plan (clear-winner)
- 2026-11-19 — D7 closed via loop-plan (asked)
