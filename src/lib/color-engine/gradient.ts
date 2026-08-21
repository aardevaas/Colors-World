import type { Oklch } from './types';
import { monotoneHueInterpolator, monotoneInterpolator, type ControlPoint } from './interpolate';
import { formatHex, formatOklchCss } from './color';

export interface GradientStop {
  readonly position: number;
  readonly oklch: Oklch;
  readonly hex: string;
  readonly css: string;
}

/**
 * Samples an OKLCH-interpolated gradient through 2+ control colors.
 *
 * Interpolating in sRGB/hex (what `linear-gradient(red, blue)` does natively)
 * desaturates through the middle — red to blue crosses a muddy grey rather
 * than a clean violet. Interpolating lightness/chroma/hue independently in
 * OKLCH, with hue taking the shortest circular path, keeps the midpoint as
 * saturated as its neighbours.
 */
export function sampleOklchGradient(
  colors: readonly Oklch[],
  steps: number
): GradientStop[] {
  if (colors.length < 2) {
    throw new Error('A gradient needs at least 2 colors.');
  }
  if (!Number.isInteger(steps) || steps < 2) {
    throw new Error(`A gradient needs at least 2 steps, received ${steps}`);
  }

  const positions = colors.map((_, i) => i / (colors.length - 1));
  const lightnessPoints: ControlPoint[] = colors.map((c, i) => ({ x: positions[i]!, y: c.l }));
  const chromaPoints: ControlPoint[] = colors.map((c, i) => ({ x: positions[i]!, y: c.c }));
  const huePoints: ControlPoint[] = colors.map((c, i) => ({ x: positions[i]!, y: c.h }));

  const lightnessAt = monotoneInterpolator(lightnessPoints);
  const chromaAt = monotoneInterpolator(chromaPoints);
  const hueAt = monotoneHueInterpolator(huePoints);

  const stops: GradientStop[] = [];
  for (let i = 0; i < steps; i += 1) {
    const t = i / (steps - 1);
    const oklch: Oklch = { l: lightnessAt(t), c: Math.max(0, chromaAt(t)), h: hueAt(t) };
    stops.push({ position: t, oklch, hex: formatHex(oklch), css: formatOklchCss(oklch) });
  }
  return stops;
}

const DEFAULT_GRADIENT_STEPS = 12;

/** A ready-to-use CSS `linear-gradient(...)` value, precomputed from sampled OKLCH stops. */
export function gradientCssString(
  colors: readonly Oklch[],
  steps: number = DEFAULT_GRADIENT_STEPS
): string {
  const stops = sampleOklchGradient(colors, steps);
  const parts = stops.map((stop) => `${stop.hex} ${(stop.position * 100).toFixed(1)}%`);
  return `linear-gradient(90deg, ${parts.join(', ')})`;
}
