import type { Oklch } from './types';

/**
 * OKLab coordinates for a color, derived from its polar OKLCH form.
 * a/b are the rectangular chroma axes — the form Euclidean distance is
 * actually meaningful in, since OKLCH's hue channel is circular and cannot be
 * subtracted directly.
 */
function toOklab(color: Oklch): { l: number; a: number; b: number } {
  const hueRadians = (color.h * Math.PI) / 180;
  return {
    l: color.l,
    a: color.c * Math.cos(hueRadians),
    b: color.c * Math.sin(hueRadians),
  };
}

/**
 * ΔE-OK: perceptual distance between two colors as Euclidean distance in
 * OKLab. OKLab was designed so that equal distances represent approximately
 * equal perceived differences, which is precisely the property a version-diff
 * magnitude — or a gamut-clamp warning — needs: "how different does this
 * actually look," not just "how different are the numbers."
 */
export function deltaEOk(a: Oklch, b: Oklch): number {
  const labA = toOklab(a);
  const labB = toOklab(b);
  return Math.sqrt(
    (labA.l - labB.l) ** 2 + (labA.a - labB.a) ** 2 + (labA.b - labB.b) ** 2
  );
}

/** Signed shortest-path hue delta, e.g. 350° → 10° is +20°, not -340°. */
export function shortestHueDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}
