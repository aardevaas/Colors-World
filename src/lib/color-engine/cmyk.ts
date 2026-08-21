import type { Cmyk, Oklch } from './types';
import { clamp01, toRgb } from './color';
import { mapToGamut } from './gamut';

/**
 * Naive device-independent CMYK — the same formula Adobe Color and Coolors
 * show. It is deliberately not press-accurate: it round-trips through sRGB,
 * so it has no notion of any particular press's ink limits or gamut. It is
 * good for "what would I type into a print-shop form," not "how will this
 * actually look on paper" — that honesty lives in the `'print'` pseudo-gamut
 * in gamut.ts instead.
 *
 * culori has no CMYK converter at all (confirmed: `converter('cmyk')` is a
 * stub that throws on call), so this is hand-written rather than delegated.
 */
export function toCmyk(color: Oklch): Cmyk {
  // Gamut-map to sRGB first so an out-of-gamut OKLCH value (which would
  // otherwise produce negative or >1 channel intermediate values) yields the
  // same displayable color CMYK is being computed *for*.
  const { r, g, b } = toRgb(mapToGamut(color, 'srgb').oklch);
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;

  const k = 1 - Math.max(rf, gf, bf);
  if (k >= 1) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }

  const c = (1 - rf - k) / (1 - k);
  const m = (1 - gf - k) / (1 - k);
  const y = (1 - bf - k) / (1 - k);

  return {
    c: Math.round(clamp01(c) * 100),
    m: Math.round(clamp01(m) * 100),
    y: Math.round(clamp01(y) * 100),
    k: Math.round(clamp01(k) * 100),
  };
}

/** Renders as the compact print-shop notation, e.g. "C:76 M:47 Y:0 K:4". */
export function formatCmyk(cmyk: Cmyk): string {
  return `C:${cmyk.c} M:${cmyk.m} Y:${cmyk.y} K:${cmyk.k}`;
}
