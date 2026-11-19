import { Container, Graphics, Text } from "pixi.js";
import { GAME_PALETTE, weaponLook } from "@/shared/config/gamePalette";
import { traceEmblem } from "@/shared/services/emblemRenderer";
import { GAME_FONT_FAMILY } from "@/shared/utils/gameFont";
import { playerEmblemShape } from "@/shared/utils/playerEmblem";
import { pillRow } from "@/shared/utils/pillRow";
import { weaponTunables, type HeldWeapon } from "@/features/combat/api/combatApi";
import type { GameState } from "@/features/match/services/gameSim";
import { roundResultLabel } from "@/features/match/services/matchRules";

/**
 * Screen-space HUD (DESIGN_LANGUAGE § 7): a timer card centred at the top, one player card per
 * joined slot (P1–P2 left, P3–P4 right) with emblem chip, health chunks (a lost chunk pops out),
 * the held weapon's ammo pills in its accent colour, and score, and the round-result banner. All colours are fixed canvas colours from the palette,
 * never UI theme tokens: the canvas looks the same in light and dark mode (match-rules D7).
 * Text is Fredoka; the session waits for the font before creating this view (visual-pass D5).
 */
export interface HudView {
  root: Container;
  timer: { root: Container; text: Text };
  cards: Map<number, PlayerCard>;
  banner: { root: Container; title: Text; hint: Text };
}

interface PlayerCard {
  root: Container;
  pips: Graphics;
  /** The chunk that was just lost, popping out (scale 1.3 → 0). */
  pop: Graphics;
  poppedAt: number;
  score: Text;
  /** Score last shown and when it last went up (the score pop, pickup-juice D1). */
  scoreShown: number;
  scoredAt: number;
  shown: { health: number; max: number };
  /** Ammo pills of the held weapon; hidden when unarmed. */
  ammo: Graphics;
  /** `itemId:ammo:max` last drawn, so pills redraw only on change. */
  ammoShown: string;
}

const DESIGN_WIDTH = 1280;
const CARD = { w: 228, h: 86, radius: 18, gap: 12, margin: 16, top: 12, tilt: 0.026 };
const TIMER = { w: 140, h: 70, radius: 18, warnSeconds: 10 };
const PIP = { w: 22, h: 20, radius: 7, gap: 4, x: 70, y: 40, popSeconds: 0.15 };
/** The score number pops when it goes up: scale 1.35 → 1 over the `squash` window (pickup-juice D1). */
const SCORE_POP = { seconds: 0.15, scale: 1.35 };
/** Ammo row under the health chunks (weapon-visuals D3): same pills, weapon accent, health-row width. */
const AMMO = { y: 66, h: 10, radius: 5, gap: 3 };
/** Health row width: `max` chunks of `PIP.w`; the ammo row spans the same width. */
const healthRowWidth = (max: number): number => max * (PIP.w + PIP.gap) - PIP.gap;
const BANNER = { w: 560, h: 160, radius: 24 };
const OUTLINE = 3;

const ink = (width: number) => ({ width, color: GAME_PALETTE.ink, join: "round" as const });
const slotColor = (slot: number): number =>
  GAME_PALETTE.players[slot % GAME_PALETTE.players.length] ?? GAME_PALETTE.ink;
const text = (size: number, fill: number, weight: "600" | "700" = "700"): Text =>
  new Text({
    text: "",
    style: { fontFamily: GAME_FONT_FAMILY, fontSize: size, fontWeight: weight, fill },
  });

/** The helmet emblem of a slot (● ▲ ■ ✚, DESIGN_LANGUAGE § 1), in ink, centred on 0,0. */
const drawEmblem = (slot: number, size: number): Graphics =>
  traceEmblem(new Graphics(), playerEmblemShape(slot, size / 2)).fill(GAME_PALETTE.ink);

function drawChip(slot: number): Container {
  const chip = new Container();
  chip.addChild(
    new Graphics().roundRect(-25, -25, 50, 50, 14).fill(slotColor(slot)),
    drawEmblem(slot, 20)
  );
  chip.position.set(35, 35);
  return chip;
}

/** Score (30 px) with its small `PTS` caption, right-aligned on the card. */
function drawScore(): { score: Text; caption: Text } {
  const score = text(30, GAME_PALETTE.ink);
  score.anchor.set(1, 0);
  score.position.set(CARD.w - 12, 6);
  const caption = text(11, GAME_PALETTE.hud.caption, "600");
  caption.text = "PTS";
  caption.style.letterSpacing = 1.3;
  caption.anchor.set(1, 0);
  caption.position.set(CARD.w - 12, 44);
  return { score, caption };
}

function createPlayerCard(slot: number): PlayerCard {
  const root = new Container({ label: `card-p${slot + 1}` });
  const label = text(20, GAME_PALETTE.ink);
  label.text = `P${slot + 1}`;
  label.position.set(PIP.x, 10);
  const { score, caption } = drawScore();
  const pips = new Graphics();
  const pop = new Graphics()
    .roundRect(-PIP.w / 2, -PIP.h / 2, PIP.w, PIP.h, PIP.radius)
    .fill(slotColor(slot));
  pop.visible = false;
  const card = new Graphics()
    .roundRect(0, 0, CARD.w, CARD.h, CARD.radius)
    .fill(GAME_PALETTE.hud.card)
    .stroke(ink(OUTLINE));
  const ammo = new Graphics();
  root.addChild(card, drawChip(slot), label, pips, pop, ammo, score, caption);
  root.pivot.set(CARD.w / 2, CARD.h / 2);
  root.rotation = slot % 2 === 0 ? -CARD.tilt : CARD.tilt;
  return {
    root,
    pips,
    pop,
    poppedAt: -Infinity,
    score,
    scoreShown: 0,
    scoredAt: -Infinity,
    shown: { health: -1, max: -1 },
    ammo,
    ammoShown: "",
  };
}

interface AmmoLook {
  weapon: HeldWeapon | null;
  max: number;
  /** Health row width, so both rows line up. */
  rowWidth: number;
}

/**
 * Redraws the ammo pills only when the weapon, its ammo or capacity changed (weapon-visuals D3).
 * Ammo is rounded up: a spray weapon's fuel drains in fractions of a second (fire-spread D6), one
 * pill per started second.
 */
function drawAmmo(card: PlayerCard, { weapon, max, rowWidth }: AmmoLook): void {
  const filled = weapon ? Math.ceil(weapon.ammo) : 0;
  const key = weapon ? `${weapon.itemId}:${filled}:${max}` : "";
  if (card.ammoShown === key) return;
  card.ammoShown = key;
  card.ammo.clear();
  card.ammo.visible = weapon !== null;
  if (!weapon) return;
  const { accent } = weaponLook(weapon.itemId);
  const pills = pillRow({ count: max, filled, width: rowWidth, gap: AMMO.gap });
  for (const pill of pills) {
    card.ammo
      .roundRect(PIP.x + pill.x, AMMO.y, pill.w, AMMO.h, AMMO.radius)
      .fill(pill.filled ? accent : GAME_PALETTE.healthLost);
  }
}

interface PipsLook {
  slot: number;
  health: number;
  max: number;
  /** Sim time, for the chunk pop. */
  timeSeconds: number;
}

/** Redraws the health chunks only when health or the chunk count changed; a loss starts the pop. */
function drawPips(card: PlayerCard, { slot, health, max, timeSeconds }: PipsLook): void {
  if (card.shown.health === health && card.shown.max === max) return;
  if (card.shown.max === max && health < card.shown.health && health >= 0) {
    card.pop.position.set(PIP.x + health * (PIP.w + PIP.gap) + PIP.w / 2, PIP.y + PIP.h / 2);
    card.poppedAt = timeSeconds;
  }
  card.shown = { health, max };
  card.pips.clear();
  for (const pill of pillRow({
    count: max,
    filled: health,
    width: healthRowWidth(max),
    gap: PIP.gap,
  })) {
    card.pips
      .roundRect(PIP.x + pill.x, PIP.y, pill.w, PIP.h, PIP.radius)
      .fill(pill.filled ? slotColor(slot) : GAME_PALETTE.healthLost);
  }
}

/** Shows the score; a rise (an orb, a kill) starts the pop, which eases back to size. */
function syncScore(card: PlayerCard, score: number, timeSeconds: number): void {
  if (score !== card.scoreShown) {
    if (score > card.scoreShown) card.scoredAt = timeSeconds;
    card.scoreShown = score;
    card.score.text = String(score);
  }
  const t = (timeSeconds - card.scoredAt) / SCORE_POP.seconds;
  card.score.scale.set(t >= 0 && t < 1 ? 1 + (SCORE_POP.scale - 1) * (1 - t) : 1);
}

function syncPop(card: PlayerCard, timeSeconds: number): void {
  const t = (timeSeconds - card.poppedAt) / PIP.popSeconds;
  card.pop.visible = t >= 0 && t < 1;
  if (card.pop.visible) card.pop.scale.set(1.3 * (1 - t));
}

function createTimer(): HudView["timer"] {
  const root = new Container({ label: "timer" });
  const value = text(42, GAME_PALETTE.hud.timer);
  value.anchor.set(0.5);
  root.addChild(
    new Graphics()
      .roundRect(-TIMER.w / 2, -TIMER.h / 2, TIMER.w, TIMER.h, TIMER.radius)
      .fill(GAME_PALETTE.ink),
    value
  );
  return { root, text: value };
}

function createBanner(): HudView["banner"] {
  const root = new Container({ label: "round-result" });
  const title = text(48, GAME_PALETTE.ink);
  title.anchor.set(0.5);
  title.position.set(0, -22);
  const hint = text(20, GAME_PALETTE.hud.caption, "600");
  hint.anchor.set(0.5);
  hint.position.set(0, 42);
  root.addChild(
    new Graphics()
      .roundRect(-BANNER.w / 2, -BANNER.h / 2, BANNER.w, BANNER.h, BANNER.radius)
      .fill(GAME_PALETTE.hud.card)
      .stroke(ink(OUTLINE)),
    title,
    hint
  );
  root.visible = false;
  return { root, title, hint };
}

export function createHudView(): HudView {
  const root = new Container({ label: "hud" });
  const timer = createTimer();
  const banner = createBanner();
  root.addChild(timer.root, banner.root);
  return { root, timer, cards: new Map(), banner };
}

const formatClock = (seconds: number): string => {
  const whole = Math.ceil(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

export interface HudFrame {
  state: GameState;
  viewport: { width: number; height: number };
}

function syncTimer(view: HudView, frame: HudFrame, scale: number): void {
  const { round } = frame.state;
  const warn = round.phase === "playing" && round.remainingSeconds <= TIMER.warnSeconds;
  view.timer.text.text = round.phase === "ended" ? "0:00" : formatClock(round.remainingSeconds);
  view.timer.text.style.fill = warn ? GAME_PALETTE.timerWarning : GAME_PALETTE.hud.timer;
  // Last 10 s: one pulse per second, largest as the second ticks over.
  const pulse = warn ? 1 + 0.12 * (round.remainingSeconds % 1) : 1;
  view.timer.text.scale.set(pulse);
  view.timer.root.scale.set(scale);
  view.timer.root.position.set(frame.viewport.width / 2, (CARD.top + TIMER.h / 2) * scale);
}

/** Card centre for a slot: P1, P2 on the left, P3, P4 on the right, reading left to right. */
function cardCentre(slot: number, frame: HudFrame, scale: number): { x: number; y: number } {
  const step = (CARD.w + CARD.gap) * scale;
  // Left: P1 at the edge, P2 inside. Right: P3 inside, P4 at the edge.
  const steps = slot < 2 ? slot % 2 : 1 - (slot % 2);
  const fromEdge = (CARD.margin + CARD.w / 2) * scale + steps * step;
  const x = slot < 2 ? fromEdge : frame.viewport.width - fromEdge;
  return { x, y: (CARD.top + CARD.h / 2) * scale };
}

/** The card for a slot, created and added behind the timer on first sight. */
function cardFor(view: HudView, slot: number): PlayerCard {
  const existing = view.cards.get(slot);
  if (existing) return existing;
  const card = createPlayerCard(slot);
  view.cards.set(slot, card);
  view.root.addChildAt(card.root, 0);
  return card;
}

function syncCards(view: HudView, frame: HudFrame, scale: number): void {
  const { state } = frame;
  const max = state.tunables.combat.maxHealth;
  for (const player of state.players) {
    const card = cardFor(view, player.slot);
    const fighter = state.combat.fighters.get(player.id);
    const health = fighter?.health ?? max;
    drawPips(card, { slot: player.slot, health, max, timeSeconds: state.timeSeconds });
    syncPop(card, state.timeSeconds);
    const weapon = fighter?.weapon ?? null;
    drawAmmo(card, {
      weapon,
      max: weapon ? weaponTunables(state.tunables, weapon.itemId).ammo : 0,
      rowWidth: healthRowWidth(max),
    });
    syncScore(card, state.rules.scores[player.slot] ?? 0, state.timeSeconds);
    const centre = cardCentre(player.slot, frame, scale);
    card.root.position.set(centre.x, centre.y);
    card.root.scale.set(scale);
  }
}

function syncBanner(view: HudView, frame: HudFrame, scale: number): void {
  const { round, timeSeconds, tunables } = frame.state;
  const { banner } = view;
  banner.root.visible = round.phase === "ended";
  if (!banner.root.visible) return;
  const label = roundResultLabel(round.winners);
  if (banner.title.text !== label) {
    // Set once per result: style writes re-render the text.
    banner.title.text = label;
    const winner = round.winners.length === 1 ? round.winners[0] : undefined;
    banner.title.style.fill = winner === undefined ? GAME_PALETTE.ink : slotColor(winner);
    banner.title.style.stroke = { width: winner === undefined ? 0 : 6, color: GAME_PALETTE.ink };
  }
  const locked = timeSeconds - (round.endedAt ?? timeSeconds) < tunables.match.restartLockSeconds;
  banner.hint.text = locked ? "Final scores" : "Jump: rematch · Back (Q / ⌫ / B): lobby";
  banner.root.scale.set(scale);
  banner.root.position.set(frame.viewport.width / 2, frame.viewport.height / 2);
}

/** Draws the HUD for the latest state. Call once per rendered frame. */
export function syncHudView(view: HudView, frame: HudFrame): void {
  // Scale with the viewport (DESIGN_LANGUAGE § 7 sizes are at 1280 wide); never above 1.
  const scale = Math.min(1, frame.viewport.width / DESIGN_WIDTH);
  syncTimer(view, frame, scale);
  syncCards(view, frame, scale);
  syncBanner(view, frame, scale);
}
