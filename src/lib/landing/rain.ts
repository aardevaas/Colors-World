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
 *  so scrolling reveals more drops without ever remounting the layer.
 *
 *  Raised on request, 54 → 76 → 100 → 150 — the page wanted more weather
 *  throughout, not a different curve. The shape of the ramp is unchanged; the
 *  quadratic still keeps the hero the sparse end. */
export const MAX_DROPS = 150;

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
    //
    // The range runs from 2.5px to the same 22px ceiling as before, rather than
    // the old 7px floor — the field wanted a real spread of sizes, and 7 to 22
    // is under a factor of three, which reads as one size of drop slightly
    // varied. The exponent biases the distribution toward the small end, the
    // way depth of field actually works: a few drops near the glass and a great
    // many far behind it. Linear interpolation gave a flat spread that looked
    // sorted rather than deep.
    const size = 2.5 + (1 - depth) ** 1.5 * 19.5;

    drops.push({
      // Golden-ratio (low-discrepancy) placement, not a hash.
      //
      // A hash is uniform only in the limit. Drops are revealed in index order,
      // so at low intensity you see a *prefix* of the field — and a hashed
      // prefix clumps: the left of the screen was nearly empty while the right
      // had most of the rain. This sequence has the property that every prefix
      // is already spread across the full width, so six drops cover the screen
      // as evenly as fifty do. The small hashed jitter keeps it off a grid.
      left: (((i * 0.618033988749895) % 1) * 94 + hash(i, 1) * 5 + 0.5) % 100,
      // A wide spread is what stops the field reading as a loop. Every drop
      // repeats on its own cycle forever, so if the durations sit close
      // together they resynchronise and you see the same rain over and over.
      // 6-26s means neighbouring drops drift apart and effectively never
      // realign within a visit.
      duration: 6 + depth * 12 + hash(i, 6) * 8,
      // Spread across a window longer than the longest fall, so the field is
      // already scattered through its cycle on the first frame.
      //
      // Low-discrepancy rather than hashed, for the same reason `left` is — and
      // it was still hashed here by oversight. A hash is uniform only in the
      // limit, so at 100 drops it started stacking starts on top of each other:
      // 83 distinct positions instead of 100, with the clumping worst exactly
      // where the field is densest. The plastic constant below is used rather
      // than φ so the sequence does not correlate with the one placing `left`,
      // which would tie a drop's start to its column.
      //
      // No hashed jitter on top, unlike `left`. A second of jitter is wider
      // than the sequence's own 0.29s spacing at this density, so it scrambled
      // the even spread straight back into a hash — 81 distinct starts, worse
      // than the hash it replaced. Nothing is lost: `left` needs jitter because
      // an even spread across the width IS visible as a grid, while an even
      // spread through a cycle is not, and the 6-26s duration spread pulls the
      // drops out of step within the first second anyway.
      delay: -(((i * 0.7548776662466927) % 1) * 29),
      size,
      roomIndex: Math.floor(hash(i, 3) * ROOM_IDS.length) % ROOM_IDS.length,
      depth,
      sway: (hash(i, 4) - 0.5) * 44,
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

/**
 * How hard it rains at a given point in the scroll.
 *
 * `progress` is viewports scrolled from the top, not a section fraction. The
 * hero is one viewport tall now, so a section-relative progress would divide by
 * zero — `useScrollProgress` returns a flat 0 for any section that is not taller
 * than the viewport, which is why the hero fade had silently stopped working.
 *
 * Rests low so the top of the page is barely raining, then climbs as the reader
 * leaves the hero and the rooms come up to be painted.
 */
/**
 * Raised from 0.34 with `MAX_DROPS`. The hero is still the sparse end of the
 * page — about a dozen drops rather than half a dozen — but "barely raining"
 * has become "raining lightly", which is what was asked for.
 */
export const RESTING_INTENSITY = 0.38;

export function rainIntensityAt(progress: number): number {
  const p = Number.isFinite(progress) ? Math.max(0, progress) : 0;
  // Climbs over four viewports rather than two. The earlier ramp reached full
  // rain almost as soon as the hero had gone, so the whole transition was over
  // before the reader had finished making it — the rain should still be
  // building well into the descent.
  const climb = Math.min(1, p / 4);
  return Math.min(1, RESTING_INTENSITY + (1 - RESTING_INTENSITY) * climb * climb);
}
