import type { Oklch } from '@/lib/color-engine';
import { normalizeHue } from '@/lib/color-engine';
import { shortestHueDelta } from './diff';

/**
 * Linearly blends two colors in OKLCH, `t = 0` returning `a` and `t = 1`
 * returning `b`. This is the resolution mechanism for a merge conflict that
 * isn't a clean pick of "ours" or "theirs" — a designer dragging a slider
 * between two divergent edits until the result looks right.
 *
 * Hue is blended along the shortest angular path, exactly as scale generation
 * does. A naive `lerp(a.h, b.h, t)` would, e.g., swing a 350°→10° blend the
 * long way around through 180° instead of crossing 0°.
 */
export function blendOklch(a: Oklch, b: Oklch, t: number): Oklch {
  const clampedT = Math.min(1, Math.max(0, t));
  return {
    l: lerp(a.l, b.l, clampedT),
    c: lerp(a.c, b.c, clampedT),
    h: normalizeHue(a.h + shortestHueDelta(a.h, b.h) * clampedT),
  };
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}
