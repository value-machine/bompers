# Decisions — level-direction

Job: `temp_job_level-direction`
Updated: 2026-11-18

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|

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
| Level rule switches (`data-rules`, first short list) | S | D4 A/C |
| Level gallery and remix | later | D5 |

## Log

- 2026-11-18 — options page published; D1–D5 open.
