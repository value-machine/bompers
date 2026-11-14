# Brief — Remove Supabase, sign-in and error reporting

Task: Remove Supabase, sign-in and error reporting · Lap: temp_job_remove-supabase · Harness: v0.44.0

## Problem
The owner's app is a local same-screen arena shooter with no accounts or backend, but the fork still ships Supabase, auth and error reporting that need a project, keys and sign-in setup.

## Success check
No `@supabase/*` dependency, `src/features/auth/`, `src/features/error-reporting/`, `supabaseService`, auth pages/routes or `supabase/` folder remain; `/` renders without any `VITE_SUPABASE_*` variable; `pnpm type-check`, `pnpm lint`, `pnpm arch:check`, `pnpm validate:structure` and `pnpm test:run` pass; `reference_scan.py` residue for "supabase" in `src/` is empty.

## In scope
- Delete `src/features/auth/`, `src/features/error-reporting/`, `src/shared/services/supabaseService.ts`, `AuthContext`, `useAuthBackendConfigured`, auth-only utils (`userUtils`, `profileHelpers`) and their tests.
- Delete pages `LoginPage`, `ResetPasswordPage`, `AuthCallbackPage`; their routes, `AuthProvider` and `reportError` wiring in `App.tsx` / `main.tsx`; the `ProfileMenu` and its use in `Topbar`, and sign-in references in `HomePage`.
- Delete `supabase/` (local migration file only; no remote database is touched), `@supabase/supabase-js` from `package.json` + lockfile, `.env.example` Supabase lines, `.mcp.json` Supabase server, `vite-env.d.ts` entries, `documentation/DOC_SUPABASE_GOOGLE_OAUTH.md`, Supabase mentions in unprotected docs, `ARCHITECTURE.md`, README and feature READMEs.
- Keep `QueryErrorBoundary` with a console fallback instead of `reportError`.

## Out of scope
- Will NOT do: edits to protected files (`.claude/rules/**`, `.agents/skills/**`, `.gitignore`, `eslint.ignores.js`, `projectStructure.config.cjs`, `.dependency-cruiser.cjs`) — deferred to a follow-up task that asks the owner for consent.
- Will NOT touch: hosting (`wrangler.jsonc`), UI kit, theme tokens, tasks feature, harness-overview card (own task), `CHANGELOG.md` and `documentation/jobs/**` history.
- Will NOT touch: the live Supabase project (`kyzhhofupypwmfjpbyfc`) and its tables; deleting remote data is a separate owner decision.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| `features/auth` | sign-in, callback, reset, profile | whole feature removed | ride — delete |
| `features/error-reporting` | global error handlers → Supabase upsert | whole feature removed | ride — delete |
| `shared/` (services, context, hooks, utils) | auth context and Supabase client | delete consumers first | ride |
| `layouts/` (`Topbar`, `ProfileMenu`) | profile menu in top bar | remove menu | ride |
| `pages/` | login, reset, callback, `HomePage` auth hints | remove pages and routes | ride |
| `App.tsx`, `main.tsx` | providers and error wiring | unwire | ride |
| config/deps/docs | package.json, env, mcp, docs | remove references | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size
M — three features and shared/layout/page layers, about 60 files; clean removal needs a reference scan and a residue sweep.
Cut into laps: follow-up task "Remove Supabase from rules, skills and protected configs" (needs owner consent).

## Decisions
DECISIONS.md D1–D3.
