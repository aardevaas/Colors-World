/**
 * A legible color pair per room, solved rather than chosen.
 *
 * ## Where this comes from
 *
 * GF Smith's site is built on 21 named Colorplan papers combined into 42 pair
 * utilities — every pair, in both directions — each setting nothing but a
 * background and a foreground. Components there are written against semantic
 * tokens and never name a color, so one class re-skins an entire section.
 * That architecture is the part worth taking.
 *
 * The part worth *replacing* is how the pairs are arrived at. GF Smith's 42 are
 * hand-picked by a design team against physical paper swatches, which is the
 * only option when your colors shipped in 2011 and never change. Ours are
 * generated per visit from a seed — nobody can hand-pick them, and a landing
 * page for a color tool that shipped an unchecked pair would be arguing
 * against itself in public.
 *
 * So each pair is solved here, and the guarantee is structural: a foreground is
 * only ever returned if it clears its contrast target against the background it
 * was solved for. That includes the hover variants, which are re-solved against
 * the hovered background rather than nudged and hoped over — the failure mode
 * of hand-picked pairs is precisely that the rest state was checked and the
 * hover state was not.
 *
 * The theme deliberately does NOT report the ratio it achieved. It did, so the
 * bands could print it, and that was cut — a bare "4.57:1" beside a room name
 * is a number a visitor has no way to read. The guarantee is worth more as
 * something that is simply true than as something announced, and the tests
 * below assert it directly against `contrastRatio` rather than trusting a
 * number this file reports about itself.
 *
 * ## Why the foreground is tinted rather than white
 *
 * `bestTextColor` answers the everyday question, black text or white text. That
 * is the right answer for UI and the wrong one here: two of the six bands would
 * come back white, two black, and the set would read as a template with the
 * color poured in behind it.
 *
 * Colorplan pairs are *tonal* — a deep ink of a hue on a mid tone of the same
 * hue. So the search keeps the background's hue and looks for the foreground
 * closest to it in lightness that still clears the target, taking the most
 * saturated version of that lightness which survives. Maximum cohesion subject
 * to legibility, in that order. The result is a pair that looks chosen and is
 * provably safe.
 *
 * Pure: no DOM, no React. The caller memoises.
 */

import {
  contrastRatio,
  isInGamut,
  mapToGamut,
  maxChroma,
  type Oklch,
} from '@/lib/color-engine';

/**
 * What any text on a band must clear. WCAG AA for normal text, which is also
 * AAA for large text — so one target covers every size on the band and no
 * caller has to know which rule applies to the element it is styling.
 */
export const TEXT_MIN_RATIO = 4.5;

/**
 * The relaxed target, for display type above roughly 100px and for non-text
 * marks — rules, arrows, the index numerals. AA large text plus the non-text
 * minimum, which are the same number.
 *
 * Deliberately NOT used for anything a caller might later shrink. It is a
 * separate token rather than a smaller `fg` so that the distinction survives
 * in the stylesheet instead of living in someone's memory.
 */
export const QUIET_MIN_RATIO = 3;

/** Lightness step for the foreground search. 0.005 is finer than the eye
 *  resolves at these lightnesses and keeps the whole sweep under 200 probes. */
const LIGHTNESS_STEP = 0.005;

/**
 * Chroma fractions tried at each candidate lightness, richest first. Tinting a
 * foreground costs contrast, so a hue with little headroom needs to give up
 * saturation before it gives up legibility — this is the order it does that in.
 */
const CHROMA_FRACTIONS = [0.62, 0.45, 0.3, 0.18, 0.09, 0] as const;

/**
 * How far the band moves under the pointer, in lightness. Always *away* from
 * the foreground, so the pair opens up rather than closing: hovering a link
 * should never be the moment its label gets harder to read.
 */
const HOVER_SHIFT = 0.07;

/**
 * Which side of the background an ink sits on.
 *
 * Exists because the band must carry ONE ink in two strengths. Solved freely,
 * `fg` and `fgQuiet` can land on opposite sides — a magenta band came back with
 * near-black body text and near-white display type, which reads as two
 * unrelated decisions rather than one color being spoken quietly and loudly.
 */
export type InkSide = 'darker' | 'lighter' | 'either';

export interface RoomTheme {
  /** The flooded band. */
  readonly bg: Oklch;
  /** Type of any size on that band. Clears `TEXT_MIN_RATIO`. */
  readonly fg: Oklch;
  /** Display type and non-text marks only. Clears `QUIET_MIN_RATIO`. */
  readonly fgQuiet: Oklch;
  /** The band under the pointer. */
  readonly bgHover: Oklch;
  /** Re-solved against `bgHover`, not carried over from rest. */
  readonly fgHover: Oklch;
}

/** Solves the full pair for one room color. */
export function roomTheme(bg: Oklch): RoomTheme {
  // One table for all four solves. `shiftAwayFrom` only moves lightness, and
  // the gamut map that follows it corrects chroma at constant lightness and
  // hue — measured drift across all 360 hues is exactly 0 — so the hovered
  // background shares this table rather than rebuilding it.
  const ceilings = chromaCeilings(bg.h);

  // The primary ink is solved freely; everything else on the band is then
  // pinned to the side it chose, so the band speaks one color at two volumes.
  const fg = solveForeground(bg, TEXT_MIN_RATIO, ceilings);
  const side: InkSide = fg.l <= bg.l ? 'darker' : 'lighter';
  const bgHover = shiftAwayFrom(bg, fg, HOVER_SHIFT);

  return {
    bg,
    fg,
    fgQuiet: solveForeground(bg, QUIET_MIN_RATIO, ceilings, side),
    bgHover,
    fgHover: solveForeground(bgHover, TEXT_MIN_RATIO, ceilings, side),
  };
}

/**
 * The tonal search, prioritised saturation-first.
 *
 * The ordering here is the whole design and it was wrong on the first pass.
 * Sweeping lightness on the outside and taking the richest chroma that
 * survives at the closest lightness sounds equivalent — it is not. Tinting a
 * foreground costs contrast, so the *closest* lightness that clears the target
 * is always the one reached by the least-tinted candidate, and the search
 * collapsed to `c: 0` for every hue. Six bands of grey type: the exact
 * template look the tonal pairing was meant to avoid.
 *
 * So chroma leads. Take the richest tint that can clear the target anywhere on
 * the lightness axis, then the lightness closest to the background at that
 * tint. Saturation is the larger part of reading as one color world; lightness
 * proximity is the tiebreak, not the objective.
 *
 * Falls back to plain white or black only if the hue cannot carry a foreground
 * at any lightness or tint. Unreachable for the room palette — the last
 * fraction tried is 0, and an achromatic extreme always clears against a
 * mid-lightness ground — but this is exported for backgrounds we have not seen.
 */
export function solveForeground(
  bg: Oklch,
  minRatio: number,
  ceilings: Float64Array = chromaCeilings(bg.h),
  side: InkSide = 'either'
): Oklch {
  // Richest tint first: chroma is the objective, lightness proximity only the
  // tiebreak. Returning on the first fraction that clears anywhere is also what
  // keeps this cheap — the common case is one sweep, not six.
  for (const fraction of CHROMA_FRACTIONS) {
    const candidate = closestClearing(bg, minRatio, fraction, ceilings, side);
    if (candidate !== null) return candidate;
  }
  return achromaticFallback(bg);
}

/** At one tint strength, the lightness nearest `bg` that clears `minRatio`. */
function closestClearing(
  bg: Oklch,
  minRatio: number,
  fraction: number,
  ceilings: Float64Array,
  side: InkSide
): Oklch | null {
  let best: Oklch | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < ceilings.length; i += 1) {
    const l = i * LIGHTNESS_STEP;
    if (side === 'darker' && l > bg.l) continue;
    if (side === 'lighter' && l < bg.l) continue;
    // Distance falls as the sweep approaches the background's lightness and
    // rises after it, so this skips probes that cannot beat the incumbent on
    // either side without needing to know which side we are on.
    const distance = Math.abs(l - bg.l);
    if (distance >= bestDistance) continue;

    // `noUncheckedIndexedAccess` types a Float64Array read as possibly
    // undefined even though `i` is bounded by its own length.
    const ceiling = ceilings[i] ?? 0;
    const candidate: Oklch = { l, c: ceiling * fraction, h: bg.h };
    if (contrastRatio(candidate, bg) < minRatio) continue;

    best = candidate;
    bestDistance = distance;
  }
  return best;
}

/**
 * Reachable chroma at every step of the lightness axis for one hue.
 *
 * `maxChroma` is a binary search through color-space conversions, so it is
 * hoisted out of the solve rather than called per probe. It depends on nothing
 * but lightness and hue, and all four solves for a room share a hue, so the
 * table is built once per room and handed down.
 *
 * Measured: six rooms solve in roughly 10ms. That is a one-time cost behind a
 * `useMemo` at mount rather than anything on a frame path, which is why the
 * search is left readable instead of being turned into a binary search for the
 * contrast boundary.
 */
export function chromaCeilings(hue: number): Float64Array {
  const steps = Math.round(1 / LIGHTNESS_STEP) + 1;
  const ceilings = new Float64Array(steps);
  for (let i = 0; i < steps; i += 1) {
    ceilings[i] = maxChroma(i * LIGHTNESS_STEP, hue, 'srgb');
  }
  return ceilings;
}

/** Moves `color` away from `from` in lightness, kept inside sRGB. */
function shiftAwayFrom(color: Oklch, from: Oklch, amount: number): Oklch {
  const direction = color.l >= from.l ? 1 : -1;
  const shifted: Oklch = {
    ...color,
    l: clamp01(color.l + direction * amount),
  };
  return isInGamut(shifted, 'srgb') ? shifted : mapToGamut(shifted, 'srgb').oklch;
}

/**
 * Whichever extreme reads better, returned even when neither clears the target.
 *
 * A caller handed an impossible background gets the most legible answer that
 * exists rather than an exception. Unreachable for the room palette, whose
 * grounds all sit at a mid lightness where an achromatic extreme clears
 * comfortably; a caller outside that range can compare with `contrastRatio`
 * itself if it needs to know.
 */
function achromaticFallback(bg: Oklch): Oklch {
  const white: Oklch = { l: 1, c: 0, h: bg.h };
  const black: Oklch = { l: 0, c: 0, h: bg.h };
  return contrastRatio(white, bg) >= contrastRatio(black, bg) ? white : black;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
