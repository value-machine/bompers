# Brief — Make the interface yours

Task: Make the interface yours · Lap: temp_job_interface-yours · Harness: v0.44.0

## Problem
Every surface a player or browser sees (tab title, top bar, favicon, link preview) still shows the Plate Harness template, and the template harness overview ships at `/harness`.

## Success check
Built `dist/index.html` titles the page "Bompers", links favicon.svg/.ico, apple-touch icon and manifest that all exist in `dist/`, carries og/twitter tags with absolute `https://bompers.tom-fab.workers.dev` URLs, the top bar reads "Bompers", `/harness` redirects to `/`, and the page loads in headless Chromium with no console errors.

## In scope
- Rename to Bompers: `index.html` title + meta description, top bar.
- Remove harness overview: `src/features/harness-overview/`, `src/pages/HarnessOverviewPage*`, the `/harness` route (and `MainLayout`, whose only user it is), `public/harness-overview.png`, README image, DOC_INDEX row, ARCHITECTURE tree line.
- Top bar: title + theme toggle only (already that shape; rename only).
- Identity assets from the owner-picked logo (3 options in one artifact): favicon.svg, favicon.ico, apple-touch-icon.png (180), icon-192/512.png, manifest.json, og-image.png (1200×630), static tags in index.html.

## Out of scope
- Will NOT do: design tokens / Fredoka (PR #13 design-language owns them); lobby/menus (Lobby lap).
- Will NOT touch: `src/config/app-tasks.json` (orchestrator owns it), `/tasks` dev page, game code.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| harness-overview | /harness route renders the overview | whole feature | remove |
| layouts | Topbar shows "Plate Harness"; MainLayout wraps /harness | Topbar title; MainLayout | ride / remove |
| app shell | App.tsx routes; index.html head | route table; head tags | ride |
| public/ | placeholder favicon.svg | icon files | ride |

## Size
S — removal + rename + static assets; one owner pick (logo).
Cut into laps: none

## Decisions
DECISIONS.md D1–D3.

## Plan (S)
Acceptance check: `pnpm build`, then headless Chromium on `pnpm preview` — title "Bompers", top bar "Bompers", `/harness` → `/`, every `<link rel=icon|apple-touch-icon|manifest>` and `og:image` path exists in `dist/` and answers 200 with an image/JSON type, no console errors; og/twitter tags parsed from `dist/index.html` with absolute production URLs.
1. Remove harness-overview feature, its page/test/route, `MainLayout` and `appViewLayout.ts` (no consumers left), `public/harness-overview.png`, README image, DOC_INDEX row, ARCHITECTURE tree lines, its modularity-baseline entry. Gate: type-check, lint, arch, structure, tests.
2. Rename: `index.html` title + description, Topbar text.
3. Assets from the owner-picked mark (D3), rendered once with Playwright + a one-off ICO pack in the scratchpad (no committed script, no new dependency — DOC_DECISION_LOG harness-overview-page D4): `favicon.svg`, `favicon.ico` (16+32), `apple-touch-icon.png` (180, full-bleed), `icon-192/512.png`, `manifest.json`, `og-image.png` (1200×630, Fredoka). Static head tags.
4. Verify (acceptance check) and on the PR preview.
