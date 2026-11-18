# Decisions — level-direction

Job: `temp_job_level-direction`
Updated: 2026-11-18

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D6 | Which weapons a level's crates hold | closed | Not per drop point. Weapons are a match setting like the duration: the standard is "auto" = every weapon the game has, so old maps get new weapons by themselves. A level may state an optional default (for example only rockets, or no weapons); it then works like the level's match duration. | owner, chat 2026-11-18 | Replaces `data-items` on `drop` (homing-missiles D4, fire lap's torch lists). Format change; compatibility waived earlier. Collectible `data-item` (point orb vs headbutt reset) is placement, not a weapon list: stays, agent's reading. Mostly a development aid (owner). |
| D7 | What kind of thing a level may set | closed | A level never lists or locks content per element. It may state optional match settings as defaults, in the same family as duration and gravity. | owner, chat 2026-11-18 | Narrows D4: no per-shape number overrides. |
| D8 | Objects vs the plain HTML preview | closed | The plain file promises the layout, not the look. An object is a plain box (`rect`) with its catalog ID; the catalog gives its size at 1.0; the box is the size (a bigger box = a bigger object, no separate scale number); the game and the kit preview draw the real thing inside it and warn on wrong proportions or a size out of range. | owner, chat 2026-11-18 (question tool) | Softens DOC_APP_VISION § Levels "any browser shows it as a picture" to "shows the layout"; change the vision line in the lap that builds the first object. Terrain stays drawn as written. Not tested: which agent apps block the kit script. |

## Open (asked one at a time through the orchestrator; first option = recommended)

| id | topic | status | options briefly |
|----|-------|--------|-----------------|
| D1 | Backbone direction | open | A: 2 capabilities + two dials from 3 · B: 2 only · C: 1 tight catalog, trim only · D: 4 scripted levels |
| D2 | Copy button: full prompt or short by feature (conflicts with level-gen-prompt D1) | open | A: full stays default, short-by-feature offered beside it · B: always full · C: short only |
| D3 | How an agent gets feedback on its level | open | A: "Copy import report" in the lobby · B: report also shown in the kit preview page · C: none for now |
| D4 | How much a level may change the rules for now | open | A: per-part sounds + one `data-rules` list · B: per-part sounds only · C: also per-shape number overrides · D: nothing |
| D5 | Gallery and remix | open | A: later, park · B: remix (export a played level) soon, gallery later · C: plan a gallery now |

## Proposed backlog (orchestrator adds; depends on answers)

| task | size | depends on |
|------|------|------------|
| Capabilities for the level kit: prompt, kit docs and preview built from one entry per mechanic; CI check | M | D1 A/B |
| Short prompt by feature next to "Copy AI prompt" | S | D2 A/C |
| Copy import report | S | D3 A/B |
| Element pair table (fire × ice × materials) generated into the prompt; rides with the ice lap | S | D1 A/B |
| Weapons as a match setting: lobby setting with auto = all weapons; optional level default (only some / none); remove `data-items` from drops, the format, kit, prompt and built-in levels | S–M | D6 (closed) |
| Objects in levels: `object` role as a box with a catalog ID, sizes in the catalog and prompt, fit-to-box drawing, vision line update; when the first object is wanted | M | D8 (closed) |
| Level gallery and remix | later | D5 |

## Log

- 2026-11-18 — options page published; D1–D5 open.
- 2026-11-18 — owner input in chat: D6, D7 closed; D8 opened; D4 narrowed.
- 2026-11-18 — D8 closed by the owner (box is the size).
