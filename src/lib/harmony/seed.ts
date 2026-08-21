/**
 * Where a generated palette starts.
 *
 * A uniformly random OKLCH triple is a bad seed: most of that space is either
 * out of gamut, too dark to be a brand color, or so desaturated it produces a
 * palette of greys. Rolling one is the single most-pressed control in a
 * generator, so what it returns is a product decision, not a call to
 * `Math.random`.
 *
 * This is the "curation on top of the maths" the blueprint flagged as the real
 * risk: the harmony engine buys defensible evenness, not beauty, and the seed
 * is where taste gets to intervene. Lightness is held to the band where a
 * color can act as a brand — dark enough to carry white text at some point on
 * its scale, light enough not to read as a near-black — and chroma is
 * expressed as a fraction of what the hue can actually reach, so a roll never
 * produces the muddy result that a fixed chroma gives at hues with a low
 * ceiling.
 *
 * The RNG is injected so this is deterministic under test. Callers in the app
 * pass `Math.random`.
 */

import { maxChroma, type Gamut, type Oklch } from '@/lib/color-engine';

/**
 * Lightness band a seed is drawn from. Below this a color reads as a near
 * neutral rather than a brand; above it there is too little room left to build
 * a scale upward.
 */
export const SEED_LIGHTNESS = { min: 0.5, max: 0.72 } as const;

/**
 * Chroma as a fraction of the hue's own ceiling. The floor is what keeps a
 * roll from returning something indistinguishable from grey; the ceiling backs
 * off the very edge of the gamut, where colors are vivid but brittle — any
 * scale built from them clips immediately.
 */
export const SEED_SATURATION = { min: 0.55, max: 0.95 } as const;

export interface SeedOptions {
  readonly gamut?: Gamut;
  /** Restrict the roll to a hue range, e.g. to stay in a brand family. */
  readonly hueRange?: readonly [number, number];
}

/**
 * A seed worth building a palette from.
 *
 * @param random Returns a float in [0, 1) — inject for determinism in tests.
 */
export function randomSeed(random: () => number, options: SeedOptions = {}): Oklch {
  const gamut = options.gamut ?? 'srgb';

  const [hueFrom, hueSpan] = resolveHueRange(options.hueRange);
  const h = normaliseHue(hueFrom + random() * hueSpan);
  const l = lerp(SEED_LIGHTNESS.min, SEED_LIGHTNESS.max, random());
  const saturation = lerp(SEED_SATURATION.min, SEED_SATURATION.max, random());

  // Chroma is taken as a fraction of what this hue can reach at this
  // lightness, never as an absolute. A fixed chroma that looks rich at hue 300
  // is unreachable at hue 165 and gets clipped into something muddy.
  const c = saturation * maxChroma(l, h, gamut);

  return { l, c, h };
}

/**
 * Rolls a seed whose hue is a deliberate distance from one already in play, so
 * consecutive rolls do not return near-identical palettes. Without this, a
 * uniform hue roll lands within a few degrees of the previous one often enough
 * that the generator feels broken.
 */
export function nextSeedAwayFrom(
  previousHue: number,
  random: () => number,
  options: SeedOptions = {}
): Oklch {
  const MIN_TRAVEL = 40;
  const span = 360 - 2 * MIN_TRAVEL;
  const hue = normaliseHue(previousHue + MIN_TRAVEL + random() * span);
  // The hue has to be chosen *before* the seed is rolled, not patched on
  // after. Chroma is a fraction of the ceiling at a specific hue, so rolling
  // a seed and then rewriting its hue leaves it carrying a chroma the new hue
  // cannot reach -- which is out of gamut, and clips.
  return randomSeed(random, { ...options, hueRange: [hue, hue] });
}

function resolveHueRange(range: SeedOptions['hueRange']): readonly [number, number] {
  if (range === undefined) return [0, 360];
  const [from, to] = range;
  if (!Number.isFinite(from) || !Number.isFinite(to)) return [0, 360];
  const span = normaliseHue(to - from);
  // A zero span means a single hue was asked for, which is legitimate.
  return [from, span === 0 && from !== to ? 360 : span];
}

function normaliseHue(hue: number): number {
  const wrapped = hue % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

function lerp(min: number, max: number, t: number): number {
  return min + (max - min) * t;
}
