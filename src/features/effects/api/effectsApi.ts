/** Public seam of the effects feature: the event-driven effects render layer and the game-feel cues. */
export {
  createEffectsView,
  syncEffectsView,
  type EffectsFrame,
  type EffectsView,
} from "@/features/effects/services/effectsRenderer";
export {
  createFeelState,
  hitFlashAmount,
  readFeelCues,
  type FeelBody,
  type FeelState,
  type PlayerHitFeel,
} from "@/features/effects/services/feelCues";
