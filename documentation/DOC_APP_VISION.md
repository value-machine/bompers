# App vision & goals

> **Vision status:** `ACTIVE` — When every section below reflects your real product (delete placeholder bullets; write real prose), change `DRAFT` to `ACTIVE` on this line so agents treat this file as the product SSOT.

Static, **fill-in** product brief for this fork. Agents read this before ambiguous product or UX work. **SSOT** for problem, persona, and the app’s role relative to users.

---

## Problem statement

A fast, chaotic 4-player arena shooter in the spirit of LittleBigPlanet's multiplayer battles: light blob-physics characters, rocket jumping and short rounds on a small arena. The gap it fills for players is not yet stated (see open questions).

---

## User persona

Two to four competitive players in one match, on the same screen, who want quick, physical, chaotic rounds. One player can also play alone, but only for testing.

---

## App’s role

A small local multiplayer arena shooter (platformer and/or top-down elements). The game design document (Dutch, "Game Design Document: 4-Player Arena Shooter V7") is the source for the details below.

- **In one sentence, this app:** is a same-screen arena shooter for 2–4 players where rounds are won by the highest score within the time limit.
- **Characters and combat:** each character is a round body with two round feet and a helmet; weapons fire from the helmet in the aim direction. Each player has 4 health chunks. Unarmed, the fire button is a punch that damages and knocks back. The MVP weapon is a rocket launcher that drops from the sky and removes exactly 1 chunk per hit, never hurts the shooter (so rocket jumps are free) and destroys destructible arena sections.
- **Movement and camera:** soft, momentum-based blob movement (squash on landing, curved acceleration and braking), high jumps, air control, wall-jumps. A multi-target camera keeps all active players in frame.
- **Start map:** a minimalist floating main platform with raised plateaus, open edges to fall from, no lava. Weapons, power-ups and collectibles fall from above. Level elements: player spawn points, drop locations, platform edges, adjustable out-of-bounds zones.
- **Rules:** the highest score at the end of the round wins; kills and collected items give points. After a kill the player respawns at the safe spawn point farthest from all opponents, blinks and is briefly invulnerable, and can move and shoot freely meanwhile.
- **Settings:** match duration and gravity are configurable per match or map; other arena and game variables (weapon availability at spawn, hazards) are modular and adjustable.
- **It is not:** an online game or a single-player game (single-player exists for testing only).
- **Integrates with / assumes:** none yet. Local play needs no accounts or backend.

---

## Optional: open questions

- What is the goal of the game (fun with friends, a portfolio piece, something to release), and who are the players?
- On which devices is it played (desktop with keyboard or gamepads, phone, a mix), and how do four people control it on one screen?
- Does the game live inside this web app, or does the web app only host it?
- Is the Supabase backend (accounts, database, error reporting) needed at all? Local play suggests not; it has not been stated explicitly.
