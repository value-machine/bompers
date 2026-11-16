# App vision & goals

> **Vision status:** `ACTIVE` — Product SSOT. Game mechanics SSOT: [`documentation/game/GAME_DESIGN_DOCUMENT.md`](game/GAME_DESIGN_DOCUMENT.md) (GDD V7, Dutch). When this file and the GDD disagree on a mechanic, the GDD wins; this file records how the GDD is read.

Agents read this before any product, gameplay or UX work.

---

## Problem statement

Friends sitting together want a quick, chaotic, physical party game to play on one screen in a browser — no install, no accounts. Existing arena brawlers are tied to a console or a store, and the multiplayer battle feel of LittleBigPlanet (bouncy, physics-driven, everything reacts) has no light browser equivalent.

---

## User persona

- **Who:** 2–4 people on one couch around one screen (laptop or TV), each with a gamepad or sharing a keyboard. A solo developer or tester runs single-player to try things out.
- **Goals:** pick up and play in seconds, laugh at the chaos, win the round on points.
- **Frustrations:** long setup, menus before fun, getting spawn-killed, losing track of yourself on screen.
- **Constraints:** a desktop browser; mixed input (keyboard + up to 4 gamepads); short sessions.

---

## App's role

- **In one sentence, this app:** is a fast, physics- and chaos-driven 2D arena shooter for 2–4 local players (1 for testing), where squishy blob characters fire rockets from their helmets, rocket-jump, and blow up the arena while scoring points within a timed round.
- **It is not:** an online multiplayer game (MVP is same-screen local play), a progression/meta game with accounts, unlocks or stores, or a top-down shooter (the starting map is side-view platform action).
- **Integrates with / assumes:** a static browser build (Cloudflare hosting for previews and production). No backend is needed for MVP; Supabase, sign-in and error reporting were removed (hosting lap) and come back only if a feature needs them.

---

## How the GDD is read (orchestrator calls)

Interpretations of open points in the GDD, made against the GDD itself. Change any of them by telling the orchestrator.

| GDD point | Reading |
|-----------|---------|
| "platformer- en/of top-down" | Side-view 2D platformer for MVP; the starting map (Smash-like floating platforms, gravity, wall-jumps) requires it. |
| 2–4 players, shared multi-target camera | Local same-screen multiplayer; input is keyboard (up to 2 players) plus Gamepad API (up to 4). |
| Destructible arena sections | Arena geometry is split into destructible chunks that rocket explosions remove; indestructible base parts keep the map playable. A blast picks only where it explodes and how hard; the material decides the cut: each blast has one power (0–100, rocket 50) that sets the push on players (from a nudge to flying) and the crater, cut per sample as distance × the material's toughness ≤ the crater reach (cardboard 0.7, earth 1, stone and ice unbreakable). Terrain later becomes a fine distance field with truly curved edges and crater shapes per weapon (blast-power D1–D3, D18). |
| Fire (owner, fire-design ideation) | Fire spreads outward from its source at the same speed every way through touching fuel (cardboard), never across air; it flows around stone, scorches and stops at earth, and fuel touching ice never catches. Starting values: 40 units/s, a burning cell lasts 1.5 s and is then gone. A blob that touches fire burns 2 s, then loses 1 chunk unless it touches ice or dives; bumping a rival passes the fire on. Rocket blasts do not light anything. The flamethrower is a short torch cone with 3 s of fuel per pickup (blast-power D4–D8). |
| Rocket jump without self-damage | Explosion impulse applies to the shooter; damage never does. |
| Health | 4 chunks per player; a rocket hit removes exactly 1; the unarmed bash also removes 1 and knocks back. |
| Falling off the map | Leaving the out-of-bounds zone eliminates the player (counts as a kill for the last player who hit them within a short window). Its bottom is lethal right at the level bounds; its sides and top lie so far out, derived from how far a player can fly, that nobody notices them, even with chained jumps (open-map-edges D1, owner feedback round 2). |
| Configurable settings | Match duration and gravity first; all tunables live in one settings/config module so later options plug in. |

---

## Engine (orchestrator call)

**PixiJS v8 (`pixi.js@8.23.0`) for rendering only; the game simulation is our own pure TypeScript with a fixed timestep and no physics engine.** Chosen 2026-11-14 by the orchestrator under the owner's "make your own call against the GDD" instruction while the owner was away; the owner can overrule it before the foundation PR merges.

- Why: precise platformer feel (accel curves, air steering, wall-jumps, per-map gravity) is controller code, not rigid-body physics; destructible terrain is simplest as a cell grid that blasts clear; a DOM-free `step(state, inputs, dt)` keeps the sim unit-testable in Vitest and fits the repo's layers.
- Rejected: Phaser 4 (Arcade) — least custom code, but game logic is bound to scenes and hard to test headless; PixiJS + Rapier2D — 1.3 MB WASM and fighting a rigid-body engine for platformer feel; matter-js — unmaintained since 2024.
- Main risk: we own collision and feel tuning; rockets step in small increments to avoid tunnelling.
- Sound: own small Web Audio module, no extra dependency.

## Levels (owner requirement, orchestrator design)

Levels are importable as **one self-contained HTML file with inline SVG**: any AI agent (Claude, Gemini, ChatGPT, ...) can write one, any browser shows it as a picture, and the game imports it.

- **References, not content.** A level file holds geometry, roles (platform, spawn, drop point, bounds, collectible) and IDs only. Materials, effects, sounds and behaviours live in one content catalog in the game code and are referenced by stable string ID.
- **Internal seam.** The importer (`features/level-file`) turns a file into a typed `LevelDefinition` (`features/level`); the engine never depends on the file format. Built-in levels are real level files in `public/levels/`.
- **Staying current as the game grows.** The catalog in code is the single source. The build generates the public level kit (catalog list, preview stylesheet/script, authoring guide, example level) from it, and a CI drift check fails when the kit lags behind. Files carry a format version with migrations; unknown IDs warn and fall back to a safe default, never crash.
- **Viewable outside the app.** A level references the hosted kit for a richer preview (legend, labels) but still renders as a plain picture with no network.

## Design language

Visual and audio identity: "Gumdrop Pop" (sticker-bright candy toys, ink outlines, toy-box pop sound). SSOT: [`documentation/game/DESIGN_LANGUAGE.md`](game/DESIGN_LANGUAGE.md). Picked 2026-11-14 by the orchestrator against the GDD while the owner was away.

## North-star goals

- **Goal 1:** a 4-player round on the starting map is playable end to end (join, fight, respawn, score, winner) in a desktop browser at a stable 60 fps.
- **Goal 2:** the movement feels light and bouncy: testers describe it as "squishy/fun" before they comment on anything else.

---

## Open questions

- Online play after MVP: not planned until the local game is fun.
