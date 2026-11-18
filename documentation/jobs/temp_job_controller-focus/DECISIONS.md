# Decisions — controller-focus

| # | Decision | Alternatives | Source | Status |
|---|---|---|---|---|
| D1 | Highlight look | A ink ring (rec.: still, distinct from the strip's lifted pick), B lift, C pulsing ring | options page https://claude.ai/artifact/3wJETURFQ3QVVzuJ6U2WHx | A — owner-delegated ("whatever you recommend"), 2026-11-18 |
| D2 | Keyboard-half menu keys show the mark? | Yes, like `:focus-visible`; No, pad only (owner note "PC doesn't") | conflict: owner note vs lobby D3 | Yes — owner, 2026-11-18: pad and keyboard show it, only the mouse hides it |
| D3 | Pointer hides the mark; cursor position unchanged; next pad press shows it at once | hide after a timeout; move cursor to hover | `:focus-visible` precedent, lobby/pause reducers stay the one state machine | Agent |
| D4 | Modality store lives in `src/shared/` (both lobby and pause read it) | per-feature copies | architecture § shared (2+ features) | Agent |
