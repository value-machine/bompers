# Brand marks

Sources live in `src/assets/` (only SVG location the structure whitelist allows).

Source SVGs for the Bompers app icon (style: [`DESIGN_LANGUAGE.md`](DESIGN_LANGUAGE.md), Gumdrop Pop, silhouette outline only).

| File | Status | What |
|------|--------|------|
| `src/assets/logo-bomp-sky.svg` | **in use** — `public/favicon.svg` and the PNG/ICO icons and `og-image.png` are rendered from it | Tomato and cobalt blobs clash heads on a sky tile, burst between them |
| `src/assets/logo-mascot-backup.svg` | backup (owner, interface-yours lap) | Full tomato blob with helmet, launcher and feet on a sky tile |
| `src/assets/og-mascot-backup.svg` | backup | 1200×630 link-preview card built around the mascot mark (uses Fredoka; render in a browser with the font loaded) |

To switch marks, render the PNG sizes (`apple-touch-icon.png` 180 full-bleed, `icon-192.png`, `icon-512.png`, `favicon.ico` 16+32, `og-image.png` 1200×630) once with the browser at hand and replace the files in `public/`; no committed script (DOC_DECISION_LOG harness-overview-page D4).
