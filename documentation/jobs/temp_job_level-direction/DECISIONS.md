# Decisions — level-direction

Job: `temp_job_level-direction`
Updated: 2026-11-18

All rows closed by the owner in chat on 2026-11-18 (free text or question tool). "Agent's reading" marks interpretation.

## Closed

| id | topic | choice | notes |
|----|-------|--------|-------|
| D1 | Backbone: how the file relates to mechanics, how the prompt is built | The level states layout plus optional match settings; the game owns behaviour. No prompt refactor now. The prompt changes only when a feature adds something an author can place or set in a level. A mechanic that adds neither (the ice mechanic) leaves the prompt alone, apart from a new ID in a setting (a freeze ray in the weapons setting, so an agent can declare an only-freeze-ray map). Revisit the prompt's structure when objects arrive. | Directions 3 (per-element dials) and 4 (scripted triggers) are out. The self-describing-mechanics refactor (direction 2) is not scheduled; reconsider inside the first objects lap (agent's reading). |
| D2 | Copy button: full prompt or short by feature | Not asked: follows from D1. The button keeps copying the one full prompt (level-gen-prompt D1 stands). | Agent's derivation, told to the owner in chat. |
| D3 | Feedback to the authoring agent, and how strict the importer is | Be forgiving: an odd but playable level loads as written, "unintended game pieces" are preferred over errors. Reject only when the game truly cannot run. For those, a "Copy import report" button in the lobby. | Implies a pass over E1–E8 (LEVEL_FORMAT § 7) to turn survivable ones into warnings; which ones is the build lap's call (agent's examples: no drop point → load without crates; missing bounds → take the viewBox). |
| D4 | How much a level may change the rules | Level-wide match settings only, as optional defaults (D7). No overrides on single shapes. | Follows from D7. Author-declared part sounds (moving-parts lap) were not discussed here and stay with that lap. |
| D5 | Gallery and remix | No remix feature: a player hands the file to an AI and asks for a rewrite; people will wrap the level prompt in a skill themselves. A gallery of saved levels is a later task, shape unknown. Lightweight idea to task now: the app remembers the level file's location instead of a copy, so a file the user deleted simply drops out. | Agent's caveat, not yet researched: a web page cannot store a file path; remembering a file needs the browser's file-handle API, which not every browser has. The task starts with that check. |
| D6 | Which weapons a level's crates hold | Not per drop point. Weapons are a match setting like the duration: the standard is "auto" = every weapon the game has, so old maps get new weapons by themselves. A level may state an optional default (only rockets, no weapons); it then works like the level's match duration. Mostly a development aid. | Replaces `data-items` on `drop` (homing-missiles D4, the torch lists). Format change; compatibility waived earlier. Collectible `data-item` stays: it says what sits at one spot, not which weapons are on (agent's reading, told to the owner). |
| D7 | What kind of thing a level may set | A level never lists or locks content per element. It may state optional match settings as defaults, in the family of duration and gravity. | |
| D8 | Objects vs the plain HTML preview | The plain file promises the layout, not the look. An object is a plain box (`rect`) with its catalog ID; the catalog gives its size at 1.0; the box is the size (bigger box = bigger object, no separate scale number); the game and the kit preview draw the real thing inside it and warn on wrong proportions or a size out of range. | Softens DOC_APP_VISION § Levels "any browser shows it as a picture" to "shows the layout"; change that line in the lap that builds the first object. Terrain stays drawn as written. Not tested: which agent apps block the kit script. |

## Open

None.

## Proposed backlog (the orchestrator adds these)

| task | size | from |
|------|------|------|
| Weapons as a match setting: lobby setting, auto = all weapons; optional level default (only some / none) that works like the level's duration; remove `data-items` from drops in the format, importer, kit, prompt and built-in levels | S–M | D6, D7 |
| Forgiving import: turn every rejection the game can survive into a warning with a sensible fallback; keep errors for files the game cannot run | S | D3 |
| Copy import report: one lobby button copies the remaining errors and warnings as plain text for the author's AI | S | D3 |
| Objects in levels (when the first object is wanted): `object` role as a box with a catalog ID, sizes at 1.0 in the catalog and prompt, fit-to-box drawing, proportion and range warnings, vision line "shows the layout"; revisit the prompt's structure in this lap | M | D8, D1 |
| Remember a level by its file location instead of a stored copy; first check browser support for file handles | S, research first | D5 |
| Level gallery | later, unshaped | D5 |

Standing rule for every feature lap (D1): touch the level prompt only when the feature adds something an author can place or set.

## Log

- 2026-11-18 — options page published; D1–D5 open.
- 2026-11-18 — owner input in chat: D6, D7 closed; D8 opened, then closed (box is the size).
- 2026-11-18 — D1, D3, D5 closed by the owner; D2, D4 closed by derivation.
