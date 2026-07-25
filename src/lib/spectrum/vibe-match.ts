import { shortestHueDelta, type Oklch } from '@/lib/color-engine';
import { randomSeed, shuffledIndex } from './discovery-feed';
import { TOTAL_SPECTRUM_SIZE, indexToSwatch, type GeneratedSwatch } from './generate-color';
import type { VibeSearchTarget } from './vibe-search';

/**
 * Turns a vibe-search target into actual grid swatches.
 *
 * VibeSearchTarget is deliberately a *region* — a lightness range, a chroma
 * range, and a hue spread around a seed hue (see vibe-search.ts's own
 * docstring: "a target region of OKLCH space to search against, rather than
 * a single exact colour") — not one exact point. An earlier version of this
 * function searched via a shrinking-radius ring scan around the target's
 * single seed point, ranked by deltaE. That produced visibly bad results in
 * practice: because generate-color.ts's index space is lightness-major/
 * hue-mid/chroma-minor, the indices *immediately* next to any one point
 * decode to near-duplicate rounded hex values (adjacent chroma steps
 * especially), so a tight deltaE ring returned a wall of near-identical
 * swatches instead of a genuinely varied set from across the vibe's region.
 *
 * The fix matches the type's own design: treat lightnessRange/chromaRange/
 * hueSpread as an actual match predicate (the same shape as
 * filters.ts's matchesFilters), and sample candidates via discovery-feed.ts's
 * Feistel shuffle rather than a linear or radius-based scan — that visits
 * indices in a well-distributed pseudo-random order, so accepted matches are
 * spread across the whole matching region instead of clustered around one
 * point, without needing to materialize or sort a candidate array.
 */

export interface VibeMatchOptions {
  readonly scanBudget?: number;
  /** Seeds the Feistel sampling order — exposed for deterministic tests;
   *  production callers get a fresh random draw each search. */
  readonly sampleSeed?: number;
}

/** Mirrors SpectrumBrowser's MAX_FILTER_SCAN_PER_STEP precedent — arithmetic
 *  this cheap can sample millions of candidates well within a request
 *  budget; this only guards a pathological target matching almost nothing
 *  (e.g. a razor-narrow range pinned at a gamut edge). */
const DEFAULT_SCAN_BUDGET = 2_000_000;

function matchesVibeTarget(oklch: Oklch, target: VibeSearchTarget): boolean {
  const [minLightness, maxLightness] = target.lightnessRange;
  if (oklch.l < minLightness || oklch.l > maxLightness) return false;

  const [minChroma, maxChroma] = target.chromaRange;
  if (oklch.c < minChroma || oklch.c > maxChroma) return false;

  return Math.abs(shortestHueDelta(target.seed.h, oklch.h)) <= target.hueSpread;
}

export function findVibeMatches(
  target: VibeSearchTarget,
  count: number,
  options: VibeMatchOptions = {}
): GeneratedSwatch[] {
  const scanBudget = options.scanBudget ?? DEFAULT_SCAN_BUDGET;
  const seed = options.sampleSeed ?? randomSeed();

  const matches: GeneratedSwatch[] = [];
  let scanned = 0;

  while (scanned < scanBudget && matches.length < count) {
    const index = shuffledIndex(scanned, seed);
    scanned += 1;
    if (scanned > TOTAL_SPECTRUM_SIZE) break; // exhausted the entire space
    const swatch = indexToSwatch(index);
    if (matchesVibeTarget(swatch.oklch, target)) matches.push(swatch);
  }

  return matches;
}
