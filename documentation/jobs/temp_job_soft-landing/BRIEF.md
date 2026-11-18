# Brief: soft-landing

**Problem (owner, 2026-11-18):** the jump and land sounds are too present; land sounds like a wood block, not a blob gently squishing. The landing squash should be deeper so the blob reads as soft jelly.

**Success check:** the owner picks a jump take, a land take and a squash on the listening page; in the game, jump and land sound soft, small hops squash subtly, big drops sink deep and spring back.

**Scope:** `public/audio/sfx/jump-1.mp3`, `land-1.mp3` (replaced by processed versions, no new takes); `player.squash.land` tunables and the land recovery curve in `blobPose.ts`; `JUICE_SQUASH` only if the owner picks a pose past 1.25 × 0.75. Records: sound README, GAME_JUICE ledger.

**Edges:** no sound cue or trigger code until the retrigger-guard thread has merged (orchestrator). No new generations without the owner's go. `src/config/app-tasks.json` untouched.

**Size:** S.
