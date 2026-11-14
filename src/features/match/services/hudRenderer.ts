import { Container, Graphics, Text } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import { traceEmblem } from "@/shared/services/emblemRenderer";
import { playerEmblemShape } from "@/shared/utils/playerEmblem";
import type { GameState } from "@/features/match/services/gameSim";
import { roundResultLabel } from "@/features/match/services/matchRules";

/**
 * Screen-space HUD (DESIGN_LANGUAGE § 7, simplified): a timer card centred at the top, one
 * player card per joined slot (P1–P2 left, P3–P4 right) with emblem chip, health chunks and
 * score, and the round-result banner. All colours are fixed canvas colours from the palette,
 * never UI theme tokens: the canvas looks the same in light and dark mode (match-rules D7).
 * Fredoka falls back to a rounded system face until the visual pass loads it.
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
  score: Text;
  shown: { health: number; max: number };
}

const FONT = "Fredoka, ui-rounded, 'Arial Rounded MT Bold', system-ui, sans-serif";
const DESIGN_WIDTH = 1280;
const CARD = { w: 228, h: 70, radius: 18, gap: 12, margin: 16, top: 12, tilt: 0.026 };
const TIMER = { w: 140, h: 70, radius: 18, warnSeconds: 10 };
const PIP = { w: 18, h: 16, radius: 6, gap: 4, x: 70, y: 40 };
const BANNER = { w: 560, h: 160, radius: 24 };
const OUTLINE = 4;

const ink = (width: number) => ({ width, color: GAME_PALETTE.ink, join: "round" as const });
const slotColor = (slot: number): number =>
  GAME_PALETTE.players[slot % GAME_PALETTE.players.length] ?? GAME_PALETTE.ink;
const text = (size: number, fill: number, weight: "600" | "700" = "700"): Text =>
  new Text({ text: "", style: { fontFamily: FONT, fontSize: size, fontWeight: weight, fill } });

/** The helmet emblem of a slot (● ▲ ■ ✚, DESIGN_LANGUAGE § 1), in ink, centred on 0,0. */
const drawEmblem = (slot: number, size: number): Graphics =>
  traceEmblem(new Graphics(), playerEmblemShape(slot, size / 2)).fill(GAME_PALETTE.ink);

function drawChip(slot: number): Container {
  const chip = new Container();
  chip.addChild(
    new Graphics().roundRect(-25, -25, 50, 50, 14).fill(slotColor(slot)).stroke(ink(3)),
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
  const card = new Graphics()
    .roundRect(0, 0, CARD.w, CARD.h, CARD.radius)
    .fill(GAME_PALETTE.hud.card)
    .stroke(ink(OUTLINE));
  root.addChild(card, drawChip(slot), label, pips, score, caption);
  root.pivot.set(CARD.w / 2, CARD.h / 2);
  root.rotation = slot % 2 === 0 ? -CARD.tilt : CARD.tilt;
  return { root, pips, score, shown: { health: -1, max: -1 } };
}

interface PipsLook {
  slot: number;
  health: number;
  max: number;
}

/** Redraws the health chunks only when health or the chunk count changed. */
function drawPips(card: PlayerCard, { slot, health, max }: PipsLook): void {
  if (card.shown.health === health && card.shown.max === max) return;
  card.shown = { health, max };
  card.pips.clear();
  for (let i = 0; i < max; i += 1) {
    const x = PIP.x + i * (PIP.w + PIP.gap);
    card.pips
      .roundRect(x, PIP.y, PIP.w, PIP.h, PIP.radius)
      .fill(i < health ? slotColor(slot) : GAME_PALETTE.healthLost)
      .stroke(ink(2.5));
  }
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

function syncCards(view: HudView, frame: HudFrame, scale: number): void {
  const { state } = frame;
  const max = state.tunables.combat.maxHealth;
  for (const player of state.players) {
    let card = view.cards.get(player.slot);
    if (!card) {
      card = createPlayerCard(player.slot);
      view.cards.set(player.slot, card);
      view.root.addChildAt(card.root, 0);
    }
    const fighter = state.combat.fighters.get(player.id);
    drawPips(card, { slot: player.slot, health: fighter?.health ?? max, max });
    card.score.text = String(state.rules.scores[player.slot] ?? 0);
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
