/**
 * The paint rain.
 *
 * Cartoonish droplets falling across the page — very sparse at the top, and
 * intensifying as the visitor scrolls, until the rain is what fills and feeds
 * the six rooms below.
 *
 * Deterministic on purpose. These render during SSR, and anything built from
 * `Math.random()` would differ between server and client and trip hydration.
 * A small integer hash gives the same scatter every time while still looking
 * unpatterned — the failure mode to avoid is a visible grid or a diagonal.
 *
 * Pure: no DOM, no React.
 */

import { ROOM_IDS } from '@/lib/nav/tabs';

/** The full field. `intensity` selects how many of these are actually shown,
 *  so scrolling reveals more drops without ever remounting the layer. */
export const MAX_DROPS = 54;

/** Below this the layer is effectively off — used to skip work entirely. */
export const MIN_VISIBLE_INTENSITY = 0.01;

export interface Drop {
  /** Horizontal position, 0-100, as a percentage of the viewport. */
  readonly left: number;
  /** Seconds for one fall. Bigger drops fall faster, as they should. */
  readonly duration: number;
  /** Negative, so the field is mid-fall on first paint rather than starting
   *  empty and filling from the top edge. */
  readonly delay: number;
  /** Diameter in px at full size. */
  readonly size: number;
  /** Which room's hue this drop carries — the rain is what feeds them. */
  readonly roomIndex: number;
  /** 0-1, how far back in the field it sits. Depth drives blur and opacity. */
  readonly depth: number;
  /** Slight horizontal drift so nothing falls perfectly vertically. */
  readonly sway: number;
}

/**
 * A cheap integer hash. Chosen over `Math.random()` for determinism and over a
 * seeded PRNG because there is no state to thread through — each drop's values
 * come straight from its index.
 */
function hash(index: number, salt: number): number {
  let h = Math.imul(index + salt * 0x9e37, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
}

/** The full droplet field, in a stable order. */
export function buildDrops(count: number = MAX_DROPS): readonly Drop[] {
  const total = Number.isFinite(count) ? Math.max(0, Math.min(MAX_DROPS, Math.round(count))) : 0;
  const drops: Drop[] = [];

  for (let i = 0; i < total; i += 1) {
    const depth = hash(i, 5);
    // Size and speed are linked: a drop that is nearer should be bigger *and*
    // faster, or the parallax reads backwards.
    const size = 7 + (1 - depth) * 15;

    drops.push({
      // Spread across the full width with jitter, rather than evenly spaced —
      // even spacing at these counts reads immediately as a row of dots.
      left: (hash(i, 1) * 96 + 2) % 100,
      duration: 7.5 + depth * 9,
      delay: -hash(i, 2) * 16,
      size,
      roomIndex: Math.floor(hash(i, 3) * ROOM_IDS.length) % ROOM_IDS.length,
      depth,
      sway: (hash(i, 4) - 0.5) * 26,
    });
  }

  return drops;
}

/**
 * How many drops are visible at a given intensity.
 *
 * Deliberately not linear. At the top of the page the ask is "very very
 * lightly", so the first stretch of the curve has to stay genuinely sparse —
 * a linear ramp already looks like weather at 0.2.
 */
export function visibleDrops(intensity: number): number {
  const t = clamp01(intensity);
  return Math.round(MAX_DROPS * t * t);
}

/** Opacity of the layer as a whole. Rises faster than the count, so the few
 *  drops that exist at rest are still visible rather than ghosts. */
export function fieldOpacity(intensity: number): number {
  const t = clamp01(intensity);
  return 0.35 + 0.65 * Math.sqrt(t);
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}
