/**
 * How much chroma each hue can actually reach.
 *
 * This is the engine's own argument, made computable. Every color tool draws
 * the hue wheel as a perfect circle, which quietly asserts that every hue is
 * equally saturable. It is not: the sRGB gamut is a lumpy solid in OKLCH, and
 * at a fixed lightness the achievable chroma swings by a factor of three
 * across the wheel. That single fact is why an HSL triad comes back needing
 * manual repair and ours does not, and until now it has been invisible —
 * present in the maths, absent from the interface.
 *
 * Sampling it produces a ragged perimeter rather than a circle. Drawing that
 * perimeter is the most direct explanation of the product's advantage that
 * exists, because it is not a claim; it is a measurement of the display the
 * viewer is looking at it on.
 *
 * Pure: no DOM, no React.
 */

import { maxChroma, type Gamut } from '@/lib/color-engine';

export interface CeilingSample {
  /** Degrees, 0–360. */
  readonly hue: number;
  readonly maxChroma: number;
}

export interface CeilingProfile {
  readonly lightness: number;
  readonly gamut: Gamut;
  readonly samples: readonly CeilingSample[];
  /** The hue that can hold the least chroma — what an equal-weight harmony
   *  is limited by. */
  readonly weakest: CeilingSample;
  readonly strongest: CeilingSample;
  /** strongest / weakest. The number that makes the case. */
  readonly spread: number;
}

/** Every 5 degrees: fine enough to render smoothly, cheap enough to recompute
 *  on a lightness drag without a worker. */
const DEFAULT_SAMPLES = 72;

export function chromaCeilingProfile(
  lightness: number,
  gamut: Gamut = 'srgb',
  sampleCount: number = DEFAULT_SAMPLES
): CeilingProfile {
  // Math.min/max propagate NaN rather than clamping it, so a non-finite
  // count would survive the bounds, skip the loop entirely and leave an empty
  // profile for the caller to crash on.
  const count = Number.isFinite(sampleCount)
    ? Math.max(8, Math.min(360, Math.round(sampleCount)))
    : DEFAULT_SAMPLES;
  const samples: CeilingSample[] = [];

  for (let i = 0; i < count; i += 1) {
    const hue = (i * 360) / count;
    samples.push({ hue, maxChroma: maxChroma(lightness, hue, gamut) });
  }

  let weakest = samples[0]!;
  let strongest = samples[0]!;
  for (const sample of samples) {
    if (sample.maxChroma < weakest.maxChroma) weakest = sample;
    if (sample.maxChroma > strongest.maxChroma) strongest = sample;
  }

  return {
    lightness,
    gamut,
    samples,
    weakest,
    strongest,
    // A lightness with no chroma available anywhere — pure black or white —
    // has no meaningful ratio, and dividing by it would report Infinity as
    // though it were a finding.
    spread: weakest.maxChroma > 0 ? strongest.maxChroma / weakest.maxChroma : 1,
  };
}

/**
 * The ceiling at one hue, interpolated between samples.
 *
 * Rendering wants the profile; a specific color wants its own hue. Reading
 * the nearest sample would make a spoke visibly miss the perimeter it is drawn
 * against, which is exactly the kind of small dishonesty that makes a chart
 * untrustworthy.
 */
export function ceilingAt(profile: CeilingProfile, hue: number): number {
  const { samples } = profile;
  const step = 360 / samples.length;
  const normalised = ((hue % 360) + 360) % 360;
  const index = Math.floor(normalised / step);
  const next = (index + 1) % samples.length;
  const t = (normalised - index * step) / step;
  return samples[index]!.maxChroma * (1 - t) + samples[next]!.maxChroma * t;
}
