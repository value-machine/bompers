# Debugging and Logging

## Logs

- Do not remove debugging logs until the user confirms they are no longer needed.
- Logs must pass lint.
- For production builds, prefer:
  - A small logger or condition like:
    - `if (import.meta.env.VITE_DEBUG_API) { console.log(...) }`
  - So logs can be disabled in production.

## API troubleshooting and pagination

Request/response logging and the round-number pagination check: `.claude/rules/app-code.md` § API Troubleshooting and § Filtering and Pagination (loads with `src/**`).

## Debugging Strategy

### Reductive Strategy (Bugs and New Features)

**Always simplify first**: When fixing bugs, implementing new features, or refactoring, always first simplify and reduce code.

- Default approach: Try to achieve the result by removing or simplifying existing code
- Only add code when: Simplification failed OR user explicitly gave permission to add code
- Prefer removing code over adding code
- Applies to: Bug fixes, feature requests, refactoring, and performance improvements

### User Testing Instructions

When asking the user to test something, give the next step for **both** outcomes — "If SUCCESS → X", "If FAILURE → Y" — including what to check or report.

## Scientific method debugging

**Procedure SSOT:** `.agents/skills/spec-debug-runtime/SKILL.md` — event chains, hypotheses (incl. pre-registered hypothesis mode), unified steps, iterative narrowing, scope reduction and test planning. **Say what was verified and what was not; the owner confirms the fix.**

**Pattern library SSOT:** `.agents/skills/spec-debug-runtime/references/patterns.md` — updated from `loop-ship` (cleanup step) or `meta-learn-lessons` when a reusable bug class is proved.

Do not duplicate the debugging procedure in this rule. This file owns **logging**, the **reductive strategy** (an always-on correction, also for features) and **user test instructions** above; API troubleshooting and pagination live in `.claude/rules/app-code.md`.
