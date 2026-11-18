# Brief — Level prompt and level-file direction

Task: owner ask 2026-11-18 (discovery and refinement, no build) · Lap: temp_job_level-direction · Branch `claude/level-direction`

Options page (owner-facing, 4 directions + recommendation): https://claude.ai/artifact/PhVvGZyY6nqEJShZJqtP5E

## Problem

The level file holds geometry, roles and IDs; the game owns behaviour (DOC_APP_VISION § Levels). The "Copy AI prompt" is one hand-assembled builder (`src/features/level-kit/services/levelPrompt.ts`): ID lists and numbers come from the catalog and tunables, but each mechanic's explanation (fire, moving parts) is hand-written into it. At v2 with fire and moving parts the prompt is ~11.9 KB (~3,300 tokens, estimate at 3.6 chars/token) and every author pays all of it. Ice, moving parts B-2 and author-declared part sounds will each add again. The owner wants a direction for (a) where the prompt goes and (b) how the level file relates to mechanics, before those features land.

Owner constraints carried in: agent-friendly, token-light, an agent aligns shapes without seeing them, only variable settings in the prompt; backward compatibility not needed for now.

## Success check

The owner has picked a direction from the options page and answered the open questions (DECISIONS.md, all rows closed), and the backlog tasks that follow are proposed to the orchestrator. No app code changes in this lap.

## Directions considered

| # | Direction | File ↔ mechanics | Prompt |
|---|-----------|------------------|--------|
| 1 | Tight catalog | unchanged: geometry + roles + IDs | one full prompt, trimmed, grows by hand |
| 2 | Mechanics describe themselves (capabilities) | unchanged file; each author-facing mechanic ships one entry (attributes, IDs, prompt sentences from tunables, snippet, import checks); CI fails when a mechanic has none | assembled from entries; can be cut to chosen features |
| 3 | Levels turn dials | level sets bounded rule switches and a few per-shape / per-part overrides | + a little per dial, opt-in parts |
| 4 | Levels script behaviour | triggers and actions from a fixed vocabulary | at least double; high agent error rate |

Recommendation: 2 as the backbone before ice lands; from 3 only per-part sounds per moment and one level-wide `data-rules` list; a copyable import report so an agent can read the importer's errors and warnings; 4 not now; gallery and remix parked.

## Grounding notes

- Importer parses with `DOMParser` (`levelFileParser.ts`): a level file is inert data, scripts in it never run in the game. Direction 4 is the only one where an imported file can drive match flow.
- Movers are a pure function of round time (moving-parts D7); start/stop triggers (direction 4) would break that.
- A feature-picked short prompt conflicts with level-gen-prompt D1 (button copies the full prompt). Asked as Q2.
- Token and size figures other than the measured 11.9 KB are estimates, to be measured in the build lap.

## Out of scope

- Will NOT do: any code, format or kit change; edits to `src/config/app-tasks.json` (the orchestrator adds tasks).
