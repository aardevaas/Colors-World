/**
 * Scroll-driven fade curves for the landing HUD.
 *
 * Extracted from the component so the timing is verifiable in isolation:
 * the values are applied from a `requestAnimationFrame` loop, which cannot be
 * observed in a headless/backgrounded browser, so a unit test is the only
 * honest check that the windows behave as intended.
 */

/** The hero copy clears the stage while the globe gathers (morph is 0.42 →
 *  0.72), so it is fully gone before the shell closes. */
export const COPY_FADE_START = 0.28;
export const COPY_FADE_END = 0.5;

/** The scroll cue has done its job the moment you start scrolling. */
export const CUE_FADE_START = 0.03;
export const CUE_FADE_END = 0.14;

/** Below this, faded elements stop catching pointer events entirely. */
export const POINTER_CUTOFF = 0.05;

/** 1 before `start`, 0 after `end`, linear between. Clamped at both ends. */
export function fadeOut(value: number, start: number, end: number): number {
  if (end <= start) return value >= end ? 0 : 1;
  if (value <= start) return 1;
  if (value >= end) return 0;
  return 1 - (value - start) / (end - start);
}

export interface HudFade {
  readonly copyOpacity: number;
  readonly cueOpacity: number;
  /** `none` once the copy is effectively invisible, so a faded CTA can never
   *  swallow a click aimed at a particle behind it. */
  readonly copyPointerEvents: 'auto' | 'none';
}

export function resolveHudFade(progress: number): HudFade {
  const copyOpacity = fadeOut(progress, COPY_FADE_START, COPY_FADE_END);
  return {
    copyOpacity,
    cueOpacity: fadeOut(progress, CUE_FADE_START, CUE_FADE_END),
    copyPointerEvents: copyOpacity < POINTER_CUTOFF ? 'none' : 'auto',
  };
}
