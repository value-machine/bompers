# Architecture Guide

This document explains the architectural decisions and rules enforced in this harness.

**SSOT:** `.claude/rules/architecture.md` is the canonical source for architecture rules. This guide is the user-facing overview. Structure enforcement: `projectStructure.config.cjs` and `.dependency-cruiser.cjs`. Feature-local `README.md` policy and validation commands: `documentation/DOC_FEATURE_LOCAL_README.md`.

## Folder Structure

```
src/
├── assets/              # Static assets (images, etc.)
├── components/          # App-level components
│   └── common/          # Reusable UI components (pure components)
│       ├── Button/
│       └── Input/        # (kit primitives only; no feature imports, enforced by ESLint)
├── config/              # Configuration files (app-tasks JSON, git workflow)
├── features/            # Feature modules (business logic)
│   ├── arena/           # Game: terrain runtime (cell grid from level shapes, blasts, terrain layer)
│   ├── camera/          # Game: framing math + applying it to the world layer
│   ├── content-catalog/ # Game: registry of material/effect/sound/behavior/item IDs
│   ├── level/           # Game: LevelDefinition model, defaults, normalisation
│   ├── level-file/      # Game: level file importer (HTML/SVG → LevelDefinition), Load level control, kit export
│   ├── match/           # Game: GameState, stepGame systems order, render composition, GameView
│   ├── player/          # Game: player state, controller system, player render layer
│   └── tasks/           # Dev-only task backlog (/tasks)
├── layouts/             # App shell: wires features into page chrome
│   └── Topbar/          # Top bar hosting the color mode toggle
├── pages/               # Route-level page components
├── shared/              # Shared across features
│   ├── context/         # React contexts (ColorModeContext, QueryProvider)
│   ├── config/          # Game tunables + placeholder game palette
│   ├── hooks/           # Cross-feature hooks (usePixiApp)
│   ├── services/        # Game engine: fixed-step loop, browser input reader
│   ├── types/           # Game engine types (input, geometry, tunables)
│   ├── utils/           # Shared utility functions (cn, queryClient, game input mapping)
│   └── theme/           # DTCG token source (tokens/), token contract + applyTheme, color mode, layout class names
├── index.css            # Tailwind v4 setup + token wiring (values: shared/theme/tokens, W3C DTCG)
```

## Game module map

The game (`/`) is a PixiJS v8 canvas driven by our own pure-TS simulation (DOC_APP_VISION § Engine). Game design SSOT: `documentation/game/GAME_DESIGN_DOCUMENT.md`.

**Data flow per rendered frame** (`features/match/hooks/useGameSession.ts`): `gameInputService.sample()` → `advanceFixedStep` (120 Hz accumulator) → N × `stepGame(state, inputs, dt)` → `renderGame` (layers sync from state, camera applied).

| Home                                                                                                 | Owns                                                                                                                                                                                                                     | Seam other code uses                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/services/gameLoop.ts`                                                                    | Fixed-timestep accumulator                                                                                                                                                                                               | `advanceFixedStep(clock, frameSeconds, { stepSeconds, maxSteps })`                                                                                                                                                                                                                                                                                                                |
| `src/shared/services/gameInputService.ts` + `utils/gameInputMapping.ts` + `types/gameInput.types.ts` | Keyboard halves + Gamepad API → one `PlayerInput` per slot (0–3) from the lobby's slot map (null = empty slot), and one `MenuInput` per device (`INPUT_DEVICES`: two halves, pads 0–3) for menus; key autorepeat ignored | `PlayerInput { connected, moveX, aimX, aimY, jump, fire }` (held state; edges are derived in the sim)                                                                                                                                                                                                                                                                             |
| `src/shared/hooks/usePixiApp.ts`                                                                     | StrictMode-safe Pixi `Application` mount / destroy                                                                                                                                                                       | `usePixiApp(hostRef, { background })` → `Application \| null`                                                                                                                                                                                                                                                                                                                     |
| `src/shared/config/gameTunables.ts` (+ `types/gameTunables.types.ts`)                                | **All** tunables, one section per concept: `sim`, `world` (gravity), `match` (duration, respawn, protection, scoring), `collectibles`, `player`, `bodyCollision`, `tumble`, `dive`, `combat`, `camera`                   | Pass a copy into `createGameState`; each lap edits only its section                                                                                                                                                                                                                                                                                                               |
| `src/shared/utils/playerEmblem.ts` + `services/emblemRenderer.ts`                                    | Helmet emblem geometry per slot (● ▲ ■ ✚) for Pixi (helmet, HUD chip) and SVG (lobby)                                                                                                                                    | `playerEmblemShape(slot, size)`, `traceEmblem(g, shape)`                                                                                                                                                                                                                                                                                                                          |
| `src/shared/config/gamePalette.ts`                                                                   | Canvas colors from `documentation/game/DESIGN_LANGUAGE.md` § 1                                                                                                                                                           | `GAME_PALETTE`: `players`, `playerShades`, `playerTints` (by slot), `ink`, `helmet`, `eyeWhite`, `gloss`, `sky`, `pointOrb`, `hud`, `materialLooks[lookToken]`                                                                                                                                                                                                                    |
| `src/shared/utils/outlineWidth.ts`, `contactShadow.ts`, `gameFont.ts`, `displaySync.ts`              | Render helpers shared by the game layers (DESIGN_LANGUAGE § 3, § 4, § 7)                                                                                                                                                 | `outlineWidth(kind, zoom)` (zoom-clamped outline, design scale 0.44), `contactShadow(height, width)`, `waitForGameFont(ms)` + `GAME_FONT_FAMILY`, `syncDisplayById` (one sprite per entity key)                                                                                                                                                                                   |
| `features/content-catalog`                                                                           | The registry of content IDs (material, effect, sound, behavior, item) and the level defaults                                                                                                                             | `contentCatalogApi`: `resolveCatalogEntry(kind, id)` → `{ entry, isFallback }`, `CATALOG_DEFAULTS`, `exportCatalog()` (the kit's catalog.json)                                                                                                                                                                                                                                    |
| `features/level`                                                                                     | `LevelDefinition` (1:1 with the HTML/SVG level file contract), defaults, normalisation                                                                                                                                   | `levelApi`: `LevelDefinition`, `normalizeLevelDefinition` → `{ level, warnings }`                                                                                                                                                                                                                                                                                                 |
| `features/level-file`                                                                                | Level file I/O: importer (errors E1–E8, warnings W1–W10, format migrations), level library (built-in manifest `public/levels/*.html` + session imports), "Load level" control, kit generation                            | `levelFileApi`: `parseLevelFile(text)` → `LevelImportResult`, `useLevelLibrary()`, `LevelImportControl` (+ `pickerRef`), `BUILT_IN_LEVEL_FILES`                                                                                                                                                                                                                                   |
| `features/arena`                                                                                     | Terrain runtime: rasterised cell grid with per-cell material, collision, blasts, terrain layer                                                                                                                           | `arenaApi`: `rectHitsSolid`, `isSolidAt`, `getCellInfo`, `clearCircle`, `createArenaState`, terrain view                                                                                                                                                                                                                                                                          |
| `features/player`                                                                                    | Player state + controller + player layer                                                                                                                                                                                 | `playerApi`: `PlayerState` (feet point), `stepPlayers({ players, inputs, terrain, tunables, dt })`, `resolveBodyContacts` (blob-vs-blob), `reactToHit` (tumble hurt reaction), players view                                                                                                                                                                                       |
| `features/camera`                                                                                    | Framing math                                                                                                                                                                                                             | `cameraApi`: `computeCameraView({ targets, bounds, viewport, previous, padding, dt })`, `applyCameraView`                                                                                                                                                                                                                                                                         |
| `features/match`                                                                                     | `GameState`, `stepGame` systems order, match rules (scoring, respawn, protection, round end, restart), render composition + HUD, `GameView`                                                                              | `matchApi`: `createGameState`, `stepGame`, `GameState`                                                                                                                                                                                                                                                                                                                            |
| `features/effects`                                                                                   | Event-driven visual feedback: explosion starbursts, rocket-hit pops, terrain debris (reads `combat.events`)                                                                                                              | `effectsApi`: `createEffectsView`, `syncEffectsView`                                                                                                                                                                                                                                                                                                                              |
| `features/lobby`                                                                                     | Join screen: slots 1–4 from any device, shared settings menu (level, load file, duration, gravity, start), device indicators; lobby state kept across rounds                                                             | `lobbyApi`: `useLobby(levels)` → `{ state, view, dispatch, matchSetup() }`, `LobbyScreen`                                                                                                                                                                                                                                                                                         |
| `features/collectibles`                                                                              | Point orbs: schedule, fall onto the level's `point-orb` points, touch to collect, orb layer                                                                                                                              | `collectiblesApi`: `createCollectiblesState`, `stepCollectibles(…)` → `OrbCollected[]`, collectibles view                                                                                                                                                                                                                                                                         |
| `features/combat`                                                                                    | Health chunks, hit / damage API (front / back zones), unarmed-attack hook, rocket launcher pickups, rockets, explosions, spawn-protection hook, combat sim events                                                        | `combatApi`: `stepCombat` (sim step 3; optional `unarmedAttack` hook), `applyHit` / `classifyHitZone`, `CombatState` (`fighters` by player id, `rockets`, `pickups`, `events` by `seq`), `eliminateFighter` / `respawnFighter` / `isFighterEliminated` (step 4), combat view (pickups, effects, rockets, overlay layers); `CombatContext` is exported for the unarmed-attack hook |
| `features/dive`                                                                                      | Unarmed attack (dive headbutt): dive phases, strike and ricochet; damage through combat's `applyHit`                                                                                                                     | `diveApi`: `stepDives({ dive, players, combat, contacts, tunables, timeSeconds, dt })` → `DiveHit[]`, `requestDive` (for combat's `unarmedAttack` hook), `resetDive`, `DiveState`, dive view                                                                                                                                                                                      |

**Rules of the map**

- Features talk only through `features/<x>/api/<x>Api.ts` (dependency-cruiser `no-cross-feature-internals`). Direction: `lobby → level-file, level, match`; `match → level, player, camera, arena, combat, dive, collectibles`; `dive → combat, player`; `collectibles → level, player`; `combat → player, arena, level, content-catalog`; `level-file → level, content-catalog`; `player → arena`; `arena → level, content-catalog`; `level → content-catalog`; `camera` and `content-catalog` import no game feature.
- The engine runs only on a normalised `LevelDefinition` plus the content catalog, never on a file format; `level-file` imports level files (built-ins in `public/levels/`) and generates the public kit's catalog (`pnpm level-kit:sync`, drift-checked in CI). Levels reference looks, sounds and behaviours by catalog ID; unknown IDs become a safe default plus a warning.
- Only `match` knows `GameState`. Systems take the slices they need (options object), so a new concept adds one slice, one system call at its number, and one render layer.
- Simulation code (`services/` sims) has no DOM, clock or randomness source of its own; it mutates the state it is given. Pixi code lives only in `*Renderer.ts` services, `usePixiApp` and `useGameSession`.
- Systems order (`features/match/services/gameSim.ts`): 1 join slots · 2 players · 2b body contacts · 3 combat (unarmed fire → dive) · 3b dive · 4 collectibles · 5 match rules (out of bounds, scoring, respawn) · 6 round timer. Steps 2–4 get only the players in play. The camera runs per rendered frame, outside the sim.
- Level vocabulary: `documentation/game/LEVEL_FORMAT.md`. 1 world unit = 1 SVG unit, origin top-left, y down.
- Scene graph (DESIGN_LANGUAGE § 5): `stage → world (camera) → terrain, pickups, point orbs, effects, rockets, players, combat overlay (health chunks)`; `stage → hud` (timer card, player cards, round-result banner).

**Where follow-up work goes**

| Lap                                        | Home                                                                                                                                                                               |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Player movement                            | `features/player/services/playerController.ts` (`applyInput` / `applyMotion`), `playerRenderer.ts`; tunables `player` section                                                      |
| Multi-target camera                        | `features/camera/services/cameraView.ts`; tunables `camera` section (in the renderer: `state.tunables.camera`)                                                                     |
| New built-in level                         | an HTML level file in `public/levels/` plus its line in `BUILT_IN_LEVEL_FILES` (`features/level-file/services/levelFileSource.ts`; first = default)                                |
| New level format version                   | `LEVEL_FORMAT_VERSION` + a `migrateVnToVn+1` entry in `features/level-file/services/levelFileMigrations.ts` with a fixture test; a `public/level-kit/vN/` beside v1                |
| New content ID                             | `features/content-catalog`, then `pnpm level-kit:sync` (CI `level-kit:check` fails until the kit matches)                                                                          |
| Combat (weapons, power-ups)                | `features/combat`: new weapons in `services/attacks.ts` + `rockets.ts`-style projectile files; damage only through `applyHit`; tunables `combat` section                           |
| Unarmed dive ("bomp")                      | `features/dive` (`services/diveSim.ts`; tunables `dive`); starts from combat's `unarmedAttack` hook (`requestDive`), hits through `applyHit` (`kind: "contact"`, `source: "dive"`) |
| Match rules (scoring, respawn, protection) | `features/match/services/matchRules.ts` (step 5) + `spawnChoice.ts`; tunables `match` section; HUD in `hudRenderer.ts`                                                             |
| Lobby, match settings, level picker        | `features/lobby` (slots, menu reducer, settings → tunables); the page `pages/GamePage.tsx` switches lobby ⇄ `GameView`; rematch / back in `features/match/hooks/useGameSession.ts` |
| Sound                                      | read `state.combat.events` by `seq` per frame: event `type` → SFX, `terrainDestroyed.soundId` → material sound                                                                     |
| Hurt reaction (tumble)                     | `features/player/services/tumble.ts` (`reactToHit`; tunables `tumble`), called by the dive's strike and by combat explosions                                                       |

## Server State Management (TanStack Query)

Server state (config, API data) is managed by **TanStack Query**. It provides caching, deduplication, and stale-while-revalidate. The app wraps content in `QueryProvider` (see `App.tsx`).

**Provider hierarchy:** `QueryProvider` → `BrowserRouter` → routes

**Key conventions:**

- **Query keys:** Per-feature `api/keys.ts`; add `src/shared/utils/queryKeys.ts` only when features share a resource
- **Features:** mutations follow the canonical-merge pattern (`setQueryData` on success) in `DOC_TANSTACK_QUERY.md`. `/tasks` dev backlog intentionally uses local state + fetch (not TanStack).

See `documentation/DOC_TANSTACK_QUERY.md` for full reference.

## Layer Rules

### Dependency Hierarchy

```
Pages → Components → Hooks → Services → Shared Services
```

**Rules:**

1. **Pages** can import from: Components, Hooks, Layouts, shared context
2. **Components** can import from: Common components, Hooks (same feature), Types
3. **Hooks** can import from: Services (same feature), Types
4. **Services** can import from: Shared services, Types
5. **Common components** cannot import from features
6. **Components** cannot import from services directly (use hooks)
7. **Topbar** is a root-level component that is always visible (rendered in App.tsx)

### Import Patterns

Use **`@/`** path aliases only — never relative parent imports (`../`). Full mapping: `.claude/rules/architecture.md`.

```typescript
// ✅ Good
import { Button } from "@/components/common/Button";
import { cn } from "@/shared/utils/cn";

// ❌ Bad
import { Button } from "../../../components/common/Button";
import { cn } from "../../../shared/utils/cn";
```

## Feature Structure

Each feature follows this structure:

```
features/[feature-name]/
├── README.md          # Feature-local overview and maintenance notes
├── docs/              # Optional feature-local deep documentation
├── api/               # TanStack Query keys (optional, for features with server data)
├── components/      # UI components specific to this feature
├── hooks/          # React hooks that use services
├── services/       # Pure functions, API calls, business logic
├── types/          # TypeScript types for this feature
└── utils/          # Feature-specific utility functions (optional)
```

### Example: Items Feature (illustrative)

**Types** (`types/item.types.ts`):

```typescript
export interface Item {
  id: string;
  name: string;
}
```

**Service** (`services/itemService.ts`):

```typescript
// Pure functions, no React hooks
export const fetchItems = async (): Promise<Item[]> => {
  // Call the API, return data
};
```

**Hook** (`hooks/useItems.ts`):

```typescript
// Uses React hooks, calls services
export const useItems = () => {
  const [items, setItems] = useState<Item[]>([]);
  // Call itemService.fetchItems()
};
```

**Component** (`components/ItemList.tsx`):

```typescript
// UI only, uses hooks
export const ItemList = () => {
  const { items } = useItems();
  // Render list
};
```

**Page** (`pages/HomePage.tsx`):

```typescript
// Route-level, composes components
export const HomePage = () => {
  return <WelcomeContent />;
};
```

## Code Placement Rules

### Where to Put Code

| What                              | Where                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| Reusable UI component (no logic)  | `src/components/common/`                                                           |
| Feature-specific UI component     | `src/features/[feature]/components/`                                               |
| React hook with state             | `src/features/[feature]/hooks/` or `src/shared/hooks/`                             |
| Pure function, API call           | `src/features/[feature]/services/`                                                 |
| TypeScript types                  | `src/features/[feature]/types/`                                                    |
| Feature-specific utility function | `src/features/[feature]/services/` or `src/shared/utils/`                          |
| Feature-local documentation       | `src/features/[feature]/README.md` (+ optional `src/features/[feature]/docs/*.md`) |
| Route-level component             | `src/pages/`                                                                       |
| Layout wrapper                    | `src/layouts/`                                                                     |
| Global state (Context)            | `src/shared/context/`                                                              |
| Shared service (data providers)   | `src/shared/services/`                                                             |
| Shared utility (cross-feature)    | `src/shared/utils/`                                                                |

### Examples

**✅ Correct:**

```typescript
// Illustration of import direction, not a required filename.
import { useItems } from "@/features/items/hooks/useItems";
import { Button } from "@/components/common/Button";
```

**❌ Incorrect:**

```typescript
// Component importing a service (use a hook)
import { fetchItems } from "@/features/items/services/itemService";

// src/components/common/Button/Button.tsx
import { useItems } from "@/features/items/hooks/useItems"; // Common component importing a feature
```

## Code Quality Tools

This project uses three complementary tools for code quality and formatting: **GTS**, **ESLint**, and **Prettier**. Understanding their roles and how they work together is crucial for maintaining code consistency.

**Toolchain versions** (SSOT: `package.json`): Vite 8, TypeScript 6, ESLint 10, Vitest 4, Tailwind CSS 4 + shadcn/ui (Radix, lucide-react). Ignore patterns live in `eslint.config.js` via `eslint.ignores.js` (ESLint 10 no longer reads `.eslintignore`).

### Complexity Management

The project enforces complexity thresholds to maintain code maintainability:

- **Cyclomatic Complexity**: ≤ 10 per function (ESLint `complexity`)
- **Cognitive Complexity**: ≤ 15 per function (`sonarjs/cognitive-complexity`)
- **Nesting Depth**: ≤ 4 levels (ESLint `max-depth`)
- **Function Length**: ≤ 100 lines (ESLint `max-lines-per-function`; see `eslint.config.js`)
- **Statements**: ≤ 15 per function (ESLint `max-statements`)
- **Parameters**: ≤ 3 per function (ESLint `max-params`; use an options object when more are needed)

Exact thresholds live in `eslint.config.js` and `.claude/rules/code-style.md` if this list drifts.

**Refactoring Patterns Used:**

- **Extract Method/Function**: Break long functions into smaller, focused functions
- **Extract Component**: Split large React components into smaller sub-components
- **Extract Hook**: Move complex logic from components into custom hooks
- **Extract Utility**: Create utility modules for reusable logic
- **Replace Conditional with Lookup**: Use data structures instead of long if-else chains
- **Guard Clauses**: Early returns to reduce nesting depth
- **Parameter Objects**: Group related parameters into objects

When complexity violations are detected, refactor using these patterns to improve maintainability and testability.

### The Three Tools

#### 1. **ESLint** (The Engine)

- **Purpose**: Static code analysis tool that identifies bugs, enforces code quality, and catches potential errors
- **What it checks**: Logic errors, unused variables, type issues, best practices, code smells
- **Examples**: `no-var` (enforces `let`/`const`), `eqeqeq` (enforces `===`), `no-floating-promises` (catches unhandled promises)

#### 2. **GTS** (Google TypeScript Style - The Configuration)

- **Purpose**: Google's opinionated TypeScript style guide that provides a pre-configured ESLint setup
- **What it provides**:
  - Pre-configured ESLint rules following Google's standards
  - TypeScript-specific linting rules via `typescript-eslint`
  - Integration with Prettier (includes `eslint-config-prettier` and `eslint-plugin-prettier`)
  - Code quality rules like `prefer-const`, `block-scoped-var`, `prefer-arrow-callback`
- **Why we use it**: Provides a solid, battle-tested foundation of code quality rules without manual configuration

#### 3. **Prettier** (The Formatter)

- **Purpose**: Opinionated code formatter that automatically formats code for consistency
- **What it handles**: Indentation, quotes, line breaks, spacing, semicolons, trailing commas
- **Why we use it**: Eliminates formatting debates and ensures consistent code style across the entire codebase

### Why Use All Three?

Each tool serves a distinct purpose:

- **GTS**: Provides comprehensive code quality rules (Google's standards)
- **ESLint**: Allows custom rules (like our architecture enforcement rules)
- **Prettier**: Handles all formatting concerns (ensures consistent style)

Together, they provide:

- ✅ **Code Quality**: GTS + ESLint catch bugs and enforce best practices
- ✅ **Architecture Enforcement**: Custom ESLint rules prevent architectural violations
- ✅ **Consistent Formatting**: Prettier ensures uniform code style

### How They Work Together

The configuration hierarchy:

```
GTS (base rules) → Custom ESLint rules → Prettier (formatting)
```

1. **GTS** provides the foundation of code quality rules
2. **Custom ESLint rules** (in `eslint.config.js`) add project-specific architecture enforcement
3. **Prettier** handles all formatting, and ESLint defers to it via `eslint-config-prettier`

### Configuration Details

**Prettier Configuration** (`.prettierrc.json`):

- Uses **double quotes** (`"singleQuote": false`)
- 100 character line width
- 2 space indentation
- LF line endings (Unix-style)

**ESLint Configuration** (`eslint.config.js`):

- Extends GTS configuration
- Overrides GTS's quote rule to match Prettier (double quotes)
- Adds custom architecture enforcement rules

**Important**: GTS includes `eslint-config-prettier` internally, but it also sets `quotes: ['warn', 'single']` which conflicts with Prettier's double quotes. We override this in our config to ensure consistency:

```javascript
rules: {
  // Override GTS's quote rule to match Prettier (double quotes)
  quotes: ['warn', 'double', { avoidEscape: true }],
  // ... custom rules
}
```

### Workflow

1. **During Development**:
   - Your editor should format on save using Prettier
   - ESLint provides real-time feedback in your IDE
   - **Editor Setup**:
     - **VS Code/Cursor**: Install "Prettier" and "ESLint" extensions, enable "Format on Save"
     - **Other editors**: Configure Prettier and ESLint plugins to run on save

2. **Before Committing**:
   - Run `pnpm format` to format all files with Prettier
   - Run `pnpm lint` to check for code quality issues
   - Run `pnpm lint:fix` to auto-fix ESLint issues

3. **In CI/CD**:
   - `pnpm format:check` ensures code is formatted
   - `pnpm lint` ensures code quality standards are met

### Common Issues and Solutions

**Issue**: ESLint complains about quote style

- **Cause**: GTS's quote rule conflicts with Prettier
- **Solution**: Already handled in `eslint.config.js` - GTS's quote rule is overridden to match Prettier

**Issue**: Formatting conflicts between tools

- **Cause**: ESLint and Prettier both trying to enforce formatting
- **Solution**: `eslint-config-prettier` (included in GTS) disables conflicting ESLint formatting rules

**Issue**: AI agents generating wrong quotes

- **Cause**: Tools have conflicting quote preferences
- **Solution**: Configuration ensures Prettier is the single source of truth for formatting

## ESLint Rules

The project uses ESLint rules to enforce architecture and code quality:

### Architecture Enforcement Rules

- Prevents components from importing services directly
- Prevents hooks from importing components
- Prevents common components from importing features

### Code Quality Rules

- **Styling**: Every themeable value (colors per light/dark mode, fonts, radius, density, component radii, elevation, motion) is a W3C DTCG 2025.10 token in `src/shared/theme/tokens/`, generated into CSS variables (shadcn/ui names), exposed as Tailwind utilities (`bg-primary`, `rounded-button`, `elevation-md`, …). Components use those utilities, never raw hex/RGB values. Color mode and runtime overrides: [documentation/DOC_THEMING.md](./documentation/DOC_THEMING.md).
  - UI kit components (shadcn/ui on Radix) live in `src/components/common/<Name>/`; `radix-ui` is imported only there.
  - Merge class names with `cn()` from `src/shared/utils/cn.ts`.
  - **Hardcoded color detection** (`eslint.config.js`, warn): flags Tailwind arbitrary colors in class strings (`bg-[#…]`, `text-[rgb(…)]`) and raw colors in `style` props.

These rules are defined in `eslint.config.js` using GTS's flat config format.

## TypeScript Path Aliases

`@/*` → `src/*` is the only alias (`tsconfig.app.json`, mirrored in `vite.config.ts` / `vitest.config.ts`). Mirror the filesystem: `@/components/common/Button`, `@/shared/utils/cn`, `@/features/<feature>/hooks/<hook>`. Never use `../` parent imports.

## API Integration

This harness supports connecting to external APIs:

No backend or external API is configured: the app is a local, same-screen game. Add one only through the loop.

**Researching a new external API before wiring it up?** See `.claude/rules/api-integration.md` (principles) and `.agents/skills/loop-plan/references/research-api.md` (MCP-first, schema→sample procedure) — this bullet describes _what's configured_, not _how to research_ a new vendor/API.

## Dev task backlog

Local development includes an in-repo task backlog for coding agents and developers:

- **SSOT:** `src/config/app-tasks.json` (active) and `src/config/app-tasks-archive.json` (done)
- **UI:** `/tasks` route (dev-only) via `DevTasksFab`
- **API:** `vite-plugin-dev-tasks.ts` — `/__dev/tasks` endpoints (serve mode only)

Fresh clones ship onboarding tasks (Hosting, App vision, Theme). See `src/features/tasks/README.md` and `.agents/skills/loop-backlog/SKILL.md` (onboarding gates: `references/onboarding.md`).

## Best Practices

1. **Keep services pure**: Services should be pure functions, no React hooks
2. **Use hooks for state**: React hooks manage state and call services
3. **Components are UI-only**: Components render UI and call hooks
4. **Types in feature folders**: Keep types close to where they're used
5. **Shared code in shared/**: Only put truly shared code here
6. **Common components are reusable**: No business logic, just UI
7. **Connect to APIs directly**: Call APIs from feature services

## Adding a New Feature

1. Create feature folder: `src/features/[feature-name]/`
2. Create subfolders: `components/`, `hooks/`, `services/`, `types/`
3. Start with types, then services, then hooks, then components
4. Create page in `src/pages/[FeatureName]Page.tsx`
5. Register the route in `src/App.tsx` (this harness defines `<Routes>` there)
6. Write tests alongside your code — see `documentation/DOC_TESTING.md`

## Example: Adding a "Notes" Feature

```
1. Create types: src/features/notes/types/notes.types.ts
2. Create service: src/features/notes/services/notesService.ts
3. Create hook: src/features/notes/hooks/useNotes.ts
4. Create components: src/features/notes/components/NoteList.tsx, NoteForm.tsx
5. Create page: src/pages/NotesPage.tsx
6. Add route in `src/App.tsx`
7. Write tests: e.g. `src/features/notes/services/notesService.test.ts` (colocated)
```

## Questions?

If you're unsure where to put code:

1. Is it reusable UI? → `src/components/common/`
2. Is it feature-specific? → `src/features/[feature]/`
3. Is it shared across features? → `src/shared/`
4. Is it a route screen? → `src/pages/`
5. Is it a layout? → `src/layouts/`
