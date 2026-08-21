import { clampChroma, inGamut } from 'culori';
import type { Gamut, Oklch } from './types';
import { gamutMode, toCuloriOklch } from './color';
import { normalizeHue } from './interpolate';

export interface GamutMapResult {
  readonly oklch: Oklch;
  /** True when chroma had to be reduced to make the color displayable. */
  readonly clamped: boolean;
}

/** Chroma difference below which we treat two colors as the same. */
const CHROMA_EPSILON = 1e-4;

/**
 * Hue-indexed chroma retention for the `'print'` pseudo-gamut, approximating a
 * SWOP/FOGRA-style CMYK press boundary relative to sRGB. This is deliberately
 * coarse — twelve anchor hues, circularly interpolated — since no ICC profile
 * ships with this project. The shape is still a real one, though: saturated
 * greens, cyans, and blues clip hardest under ink, while yellows and oranges
 * survive close to their digital appearance. Revisit if a real profile lookup
 * ever earns its keep as a dependency.
 */
const PRINT_HUE_ANCHORS: readonly {
  readonly hue: number;
  readonly retention: number;
}[] = [
  { hue: 0, retention: 0.8 }, // red
  { hue: 30, retention: 0.85 }, // orange
  { hue: 60, retention: 0.95 }, // yellow
  { hue: 90, retention: 0.9 }, // yellow-green
  { hue: 120, retention: 0.65 }, // green
  { hue: 150, retention: 0.6 }, // green-cyan
  { hue: 180, retention: 0.55 }, // cyan
  { hue: 210, retention: 0.55 }, // cyan-blue
  { hue: 240, retention: 0.6 }, // blue
  { hue: 270, retention: 0.65 }, // blue-violet
  { hue: 300, retention: 0.8 }, // magenta
  { hue: 330, retention: 0.85 }, // pink / red-magenta
];

/** Fraction of sRGB chroma a press can hold at this hue, circularly interpolated. */
function printChromaRetention(hue: number): number {
  const h = normalizeHue(hue);
  const count = PRINT_HUE_ANCHORS.length;
  for (let i = 0; i < count; i += 1) {
    const from = PRINT_HUE_ANCHORS[i]!;
    const to = PRINT_HUE_ANCHORS[(i + 1) % count]!;
    const toHue = i === count - 1 ? to.hue + 360 : to.hue;
    if (h >= from.hue && h <= toHue) {
      const t = (h - from.hue) / (toHue - from.hue);
      return from.retention + (to.retention - from.retention) * t;
    }
  }
  // Unreachable — anchors span the full circle — but keeps the function total.
  return PRINT_HUE_ANCHORS[0]!.retention;
}

export function isInGamut(color: Oklch, gamut: Gamut): boolean {
  if (gamut === 'print') {
    return color.c <= maxChroma(color.l, color.h, gamut) + CHROMA_EPSILON;
  }
  return inGamut(gamutMode(gamut) as 'rgb')(toCuloriOklch(color));
}

/**
 * Projects a color into the target gamut by reducing chroma while holding
 * lightness and hue fixed — the CSS Color 4 gamut-mapping strategy.
 *
 * Naive per-channel RGB clipping is the common alternative and it is wrong for
 * a palette tool: clipping shifts hue, so an out-of-gamut vivid orange clips
 * toward yellow and quietly breaks the scale's hue consistency.
 *
 * For `'print'`, the same lightness/hue-preserving strategy is applied against
 * the approximate press boundary above rather than an RGB primary volume —
 * it's what turns a bright digital color honestly dull instead of clipping
 * it towards some unrelated hue.
 */
export function mapToGamut(color: Oklch, gamut: Gamut): GamutMapResult {
  if (isInGamut(color, gamut)) {
    return { oklch: color, clamped: false };
  }

  if (gamut === 'print') {
    const result: Oklch = {
      l: color.l,
      c: maxChroma(color.l, color.h, gamut),
      h: color.h,
      ...(color.alpha === undefined ? {} : { alpha: color.alpha }),
    };
    return {
      oklch: result,
      clamped: Math.abs(result.c - color.c) > CHROMA_EPSILON,
    };
  }

  const mapped = clampChroma(
    toCuloriOklch(color),
    'oklch',
    gamutMode(gamut) as 'rgb'
  );

  const result: Oklch = {
    l: mapped.l ?? color.l,
    c: mapped.c ?? 0,
    h: mapped.h === undefined ? color.h : normalizeHue(mapped.h),
    ...(color.alpha === undefined ? {} : { alpha: color.alpha }),
  };

  return {
    oklch: result,
    clamped: Math.abs(result.c - color.c) > CHROMA_EPSILON,
  };
}

/**
 * Chroma probe high enough to sit outside even Rec.2020 at any lightness, so the
 * bisection below always has an out-of-gamut starting point to search down from.
 */
const CHROMA_PROBE = 0.5;

/**
 * Largest chroma that stays inside `gamut` at the given lightness and hue.
 *
 * This is the shape of the gamut solid, sampled. It is hue-dependent in ways
 * that matter: at 95% lightness sRGB will hold roughly three times more yellow
 * chroma than blue. Any scale generator that ignores this will over-saturate
 * light blues and under-saturate light yellows.
 *
 * For `'print'`, there is no RGB primary volume to probe — instead this scales
 * the sRGB boundary by the hue-dependent retention table above.
 */
export function maxChroma(l: number, h: number, gamut: Gamut): number {
  if (gamut === 'print') {
    return printChromaRetention(h) * maxChroma(l, h, 'srgb');
  }
  const probe: Oklch = { l, c: CHROMA_PROBE, h };
  if (isInGamut(probe, gamut)) return CHROMA_PROBE;
  return mapToGamut(probe, gamut).oklch.c;
}
