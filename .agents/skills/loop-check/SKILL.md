---
name: loop-check
description: >-
  Audits the built lap before it ships: acceptance test, full tooling gates, one read-only subagent
  per relevant rule, plan compliance, a UI component lens and, at size M, the parallel lens review;
  hands blockers back to loop-build and writes the check summary for Stop 2. Use when loop-build has
  finished, before any commit or PR of loop work, or when the owner asks to "check", "validate" or
  "audit" a diff. Not for plan critique (loop-plan) or shipping (use loop-ship).
---

# loop-check

When this skill is done, the change has passed every check the repo can run, and its findings have been fixed or recorded. The check summary tells the owner at Stop 2 exactly what was verified and what wasn't.

## Edges

| Field | Value |
|---|---|
| In | Lap branch diff against its base, plan + Review contract + Amendments, lap `DECISIONS.md`, rules |
| Out | Fixes (via `loop-build`); check summary for Stop 2 ([`references/rule-audit.md`](references/rule-audit.md) § Report format) |
| Calls | always → [`references/rule-audit.md`](references/rule-audit.md) (mode `impl`, or `gate` when there's no plan) · if UI components were added or changed → [`references/component-lens.md`](references/component-lens.md) · if a heavy operation is involved (`architecture` rule § Performance cost risk) → [`spec-optimize-performance`](../spec-optimize-performance/SKILL.md) · at size M, Claude Code only → built-in `/code-review` as one lens ([`router/references/external-skills.md`](../router/references/external-skills.md) § Claude Code built-ins) · if blocking findings → [`loop-build`](../loop-build/SKILL.md) · if clean → [`loop-ship`](../loop-ship/SKILL.md) |
| Called by | [`router`](../router/SKILL.md), [`loop-build`](../loop-build/SKILL.md) |
| Next | [`loop-ship`](../loop-ship/SKILL.md) |
| Owner stops | None, unless resolving a finding hits the stop list ([`agent-behavior` rule § When to ask](../../../.claude/rules/agent-behavior.md)) |

## Steps

1. **Scope.** Diff of the lap branch against its base, plus the plan and its Review contract. Pick the mode: `impl` with a plan, `gate` without one (an owner-direct check, skill-loop D57).
2. **Fan out in one turn** ([`references/rule-audit.md`](references/rule-audit.md)):
   - one read-only subagent per relevant rule, always including `code-style` with its naming sweep;
   - the tooling pass (contract gate list, including the acceptance test);
   - the plan-compliance subagent, which checks phases against code and that lap decisions were folded into their homes;
   - at size M, the parallel critique lenses on the implementation, reusing [`loop-plan/references/plan-review.md`](../loop-plan/references/plan-review.md) § Fan-out with the diff in place of the plan; in Claude Code, one of the two agent-picked lenses is the built-in `/code-review` on the lap diff (correctness bugs), its findings graded like any other lens (Cursor: pick both lenses by hand);
   - the component lens on each UI component added or changed.
3. **Synthesize.** Deduplicate across rules, group by category, sort by severity and basis. A subagent that errored is reported as `not audited — rerun`, never silently dropped.
4. **Fix.** `contract` Blockers and Warnings go back to [`loop-build`](../loop-build/SKILL.md), then re-check the affected rules. `drift` and `advisory` findings aren't fixed; they're listed in the summary, where the owner can promote one through a Change verdict. Never weaken a rule or a config to clear a finding (`architecture` rule § Changing architecture rules and configs).
5. **Hand-off checklist** before shipping:
   - feature READMEs staged with feature code;
   - `ARCHITECTURE.md` updated after structural changes;
   - no leftover debug code (but debugging logs stay until the owner confirms they can go — `debugging` rule);
   - no new deep docs without owner approval;
   - every lap decision folded.
6. **Write the check summary** and run [`loop-ship`](../loop-ship/SKILL.md).

## Examples

**Example 1 — clean**
Input: XS lap, three files changed.
Output: mode `impl`. Four rule subagents, all clean; tooling all green; acceptance test passing. Summary `Check: 0 blockers · 0 warnings · verified: lint, types, tests, structure, arch · not verified: in-app look on mobile`.

**Example 2 — naming blocker**
Input: the diff adds a third copy of date-range parsing.
Output: `code-style` § Naming F2 finding, Blocker, `contract` basis. Back to loop-build to extract it into one role-named module; re-check `code-style` and tooling; then ship.

## Output

The check summary (it goes to Stop 2):

```text
Check (<mode>): <n> blockers fixed · <n> warnings fixed · advisory <n> (listed) · verified: <checks> · not verified: <what the owner should test>
```

## Not for

| Case | Use |
|---|---|
| Critiquing a plan before building | [`loop-plan/references/plan-review.md`](../loop-plan/references/plan-review.md) |
| Commit, PR, CI | [`loop-ship`](../loop-ship/SKILL.md) |
| Industry precedent | [`loop-plan/references/review-precedent.md`](../loop-plan/references/review-precedent.md) |
