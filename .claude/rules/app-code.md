---
paths:
  - "src/**"
---

# App Code Standards

Guidance that applies only when working in `src/**`; it loads with those files. Moved verbatim from `architecture.md`, `code-style.md` and `debugging.md` (context-cost audit R10). Folder meanings, feature granularity, naming and complexity stay in the always-on rules.

## Code placement

If code doesn't meet a layer's criteria, move it down a layer.

- **Components:** JSX, handlers that call other functions, local UI state only. No data fetching, business logic, or complex math.
- **Hooks:** logic that needs React lifecycle (`useEffect`, `useState`, `useContext`).
- **Services / utils:** everything else, in plain `.ts` — testable without a DOM.
- **Imports go downward only:** `pages → components → hooks → services → utils → types` (dependency-cruiser enforces it).
- **Barrels:** none in `pages/`; never import your own module's `index.ts` from inside the module (cycles).
- **Helper extraction from a service:** shared types live in a `types/` file; helpers import types from there and never import runtime code from the service they support (prevents cycles while reducing complexity).

**Decision order:** pure calculation → `features/*/services/` (or `shared/utils/` with 2+ consumers) · data/API access → `features/*/services/` (or `shared/services/`) · React state/effects → `features/*/hooks/` (or `shared/hooks/`) · generic UI → `components/common/` · connects features or defines a URL → `pages/`.

## Edge-case placement

Name any new symbol per `.claude/rules/code-style.md` § Naming.

- Layout state hooks (sidebar, scroll) → `shared/hooks/`; layouts consume, not own, them.
- A page that needs its own hooks/services → promote it to a feature; pages stay thin.
- Validation schemas → `features/*/types/*.schema.ts`; generic validators → `shared/utils/validation/`.
- State: feature slices `features/*/store/`, composition `store/index.ts`, cross-feature `shared/context/`.
- Route guards (if accounts are ever added) → `routes/guards/`, using the auth feature's hook (no second auth hook in `shared/hooks/`).
- Notifications/toasts → one `features/notifications/`, not split across common + shared.
- Error boundaries → `components/common/ErrorBoundary/`; reporting service → `shared/services/`.
- Keyboard shortcuts: global → one hook in `shared/hooks/`; feature → `features/*/hooks/`.
- Cross-feature transforms: the consumer owns it; 2+ consumers → `shared/utils/transformers/`.
- API normalizers: with the API call in `features/*/services/`; only truly shared ones in `shared/services/`.
- App-wide feature context: provider in `features/*/context/`, exported via the feature barrel, composed in `App.tsx`.
- Drag & drop: infrastructure in `shared/context/` + `shared/hooks/`; domain actions in the feature's hooks.
- Shared dimensions/positions: one source of truth (usually the parent, via props; context when widely shared) — no duplicated magic numbers.

## TypeScript

- No `any`: use a narrow type, `unknown`, or a local interface. Last resort for third-party gaps: `// eslint-disable-next-line @typescript-eslint/no-explicit-any` with a one-line justification.
- Explicit return types on exported and async functions; JSDoc on exported functions and types (explain *why*, not *what*).
- Catch errors as `unknown` and narrow; mark intentionally un-awaited promises with `void`.
- Services are pure functions — no React hooks.
- Imports: external first, then `@/` internal; `import type` for types; prefer named exports. Before importing a package, confirm it is in `package.json` — types for wrapped libraries often come from the wrapper (e.g. TipTap via `@tiptap/react`).

## Styling scope

Pick the scope of a styling change yourself — global tokens by default, since that is the usual intent — and state the scope you used when reporting the change. Ask only per `.claude/rules/agent-behavior.md` § When to ask (for example, when it conflicts with a recorded design decision).

| Scope | Where | Use for |
|-------|-------|---------|
| Global tokens | DTCG token files in `src/shared/theme/tokens/` → `pnpm tokens:build` (guide: `documentation/DOC_THEMING.md`) | Colors, radius, fonts, shadows, motion |
| Component | Kit variants (`cva`) in `src/components/common/<Name>/<Name>.tsx` | How every usage of a kit component (or one variant) looks |
| Instance | `className` on one usage (merge with `cn()`) | Layout and spacing only (margin, padding, position, width) — never colors or typography |

`radix-ui` is imported only by kit components in `src/components/common/` (enforced: `stack-port-radix`, `pnpm arch:check`).

## API Troubleshooting

- For request errors:
  - Log the request configuration before sending:
    - Method
    - URL
    - Query params
    - Headers (excluding auth)
    - Body (redacted when needed)
- For data processing issues:
  - Log the full raw response object, with tokens and obvious PII redacted.
- Ask the user to provide these logs during debugging.

## Filtering and Pagination

- If API responses always contain a round number of records (25, 50, 100, …) regardless of filters:
  - Suspect pagination limits first.
  - Only then dig into filter logic.
