/**
 * The Library's infinite discovery feed — a growing, appendable sequence of
 * swatches (Pinterest/photo-feed shaped), not a single virtualized list over
 * the full 16.7M-item space the way the old Spectrum browser worked.
 *
 * That distinction matters for a real, previously-hit bug: rendering a
 * virtualizer (whether @tanstack/react-virtual or the Spectrum browser's own
 * hand-rolled one) over a literal 16.7M-length list needs a scroll track
 * `itemCount * itemSize` pixels tall, which is tens of millions of CSS
 * pixels — past Chromium's/Firefox's ~33.5M px max element height, beyond
 * which layout silently breaks. The old Spectrum browser worked around this
 * with a fraction-based scroll mapping (see spectrum.module.css's
 * MAX_TRACK_PX comment). This feed sidesteps the problem entirely: the
 * virtualizer only ever measures however many items have actually been
 * *loaded* (grows by one batch as the user nears the bottom), which for any
 * real scrolling session stays many orders of magnitude below that ceiling.
 *
 * "Infinite" and "no repeats" without ever materializing a 16.7M-entry
 * shuffle array is a Feistel network: a small, seeded, invertible
 * round function over the 24 bits generate-color.ts's index space already
 * uses (256^3 = 2^24 exactly — an exact power of two, so the 24-bit domain
 * splits evenly into two 12-bit Feistel halves with no remainder to special-
 * case). Reseeding — the "Serendipity Shuffle" — just picks a new seed and
 * restarts the position counter at 0; it never touches, stores, or shuffles
 * an actual array.
 */

const HALF_BITS = 12;
const HALF_MASK = (1 << HALF_BITS) - 1;
const FEISTEL_ROUNDS = 4;
/** Golden-ratio-derived odd constant — a standard choice for round-key
 *  spacing in small hash/mix functions, chosen only for good bit dispersion,
 *  not cryptographic strength (this doesn't need to resist an adversary,
 *  only avoid visibly clustering on screen). */
const ROUND_KEY_STRIDE = 0x9e3779b1;

/** Deterministic, cheap, well-mixed — not cryptographically secure, which
 *  this has no need to be. */
function roundFunction(value: number, roundKey: number): number {
  let x = (value ^ roundKey) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return x & HALF_MASK;
}

/**
 * Maps a sequential position (0, 1, 2, …) to a pseudo-random index in
 * [0, 2^24) — the same space generate-color.ts's composeIndex/indexToSwatch
 * address. Bijective by construction (a Feistel network is invertible for
 * *any* round function, regardless of how that function itself behaves),
 * so every position up to 16,777,215 maps to a distinct swatch and the feed
 * never repeats a colour before it has shown all of them.
 */
export function shuffledIndex(position: number, seed: number): number {
  let left = (position >>> HALF_BITS) & HALF_MASK;
  let right = position & HALF_MASK;

  for (let round = 0; round < FEISTEL_ROUNDS; round += 1) {
    const roundKey = (seed + round * ROUND_KEY_STRIDE) >>> 0;
    const nextRight = (left ^ roundFunction(right, roundKey)) & HALF_MASK;
    left = right;
    right = nextRight;
  }

  return ((left << HALF_BITS) | right) >>> 0;
}

/** A fresh seed for the initial mount or a reshuffle — 32-bit unsigned,
 *  matching what roundFunction's arithmetic expects. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
