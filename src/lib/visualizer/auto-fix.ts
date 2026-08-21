/**
 * Repairs a failing contrast pair by moving **OKLCH lightness only**.
 *
 * Hue and chroma are held exactly, which is the whole point: a designer who
 * picked #7C5CFF wants that violet to still be that violet after the fix. Tools
 * that "fix" contrast by desaturating or hue-shifting produce a passing
 * interface that is no longer the brand.
 *
 * Why a search rather than a formula: WCAG contrast is defined on sRGB relative
 * luminance, which is not a closed-form function of OKLCH lightness once gamut
 * clipping is in play. Search, then *verify the achieved ratio*, is the honest
 * approach — see the `unreachable` outcome, which exists because some
 * hue/chroma combinations genuinely cannot reach a target against a given
 * background at any lightness, and silently returning a still-failing color
 * would be worse than admitting it.
 */

import { contrastRatio, formatHex, type Oklch } from '@/lib/color-engine';

/** WCAG 2.1 AA for body text. */
export const WCAG_AA_NORMAL = 4.5;
/** WCAG 2.1 AA for large text (≥24px, or ≥18.66px bold). */
export const WCAG_AA_LARGE = 3;

export type AutoFixOutcome =
  | { readonly status: 'already-passes'; readonly ratio: number }
  | {
      readonly status: 'fixed';
      readonly color: Oklch;
      readonly hex: string;
      readonly achievedRatio: number;
      /** Signed change in OKLCH lightness — negative means darkened. */
      readonly lightnessDelta: number;
    }
  | {
      readonly status: 'unreachable';
      /** The closest ratio achievable at any lightness for this hue/chroma. */
      readonly bestRatio: number;
    };

export interface AutoFixOptions {
  readonly target?: number;
  /** Which side of the pair to move. Defaults to the text. */
  readonly adjust?: 'text' | 'background';
}

const SEARCH_ITERATIONS = 40;

/**
 * Contrast against a fixed counterpart is V-shaped in lightness: it falls to
 * 1:1 where the two luminances meet, then rises again. So it is monotonic
 * *within* each direction away from that meeting point, and binary search is
 * valid per-direction — but not across the whole 0..1 range at once.
 */
function searchDirection(
  moving: Oklch,
  fixed: Oklch,
  target: number,
  towards: 0 | 1
): Oklch | null {
  const endpoint: Oklch = { ...moving, l: towards };
  if (contrastRatio(endpoint, fixed) < target) return null;

  let failing: number = moving.l;
  let passing: number = towards;
  for (let i = 0; i < SEARCH_ITERATIONS; i += 1) {
    const mid = (failing + passing) / 2;
    if (contrastRatio({ ...moving, l: mid }, fixed) >= target) passing = mid;
    else failing = mid;
  }
  return { ...moving, l: passing };
}

/**
 * Moves one color of a pair until it meets `target`, preferring the smaller
 * lightness change of the two possible directions so the result stays as close
 * to the designer's original choice as possible.
 */
export function autoFixContrast(
  text: Oklch,
  background: Oklch,
  options: AutoFixOptions = {}
): AutoFixOutcome {
  const target = options.target ?? WCAG_AA_NORMAL;
  const adjustBackground = options.adjust === 'background';

  const moving = adjustBackground ? background : text;
  const fixed = adjustBackground ? text : background;

  const currentRatio = contrastRatio(text, background);
  if (currentRatio >= target) return { status: 'already-passes', ratio: currentRatio };

  const lighter = searchDirection(moving, fixed, target, 1);
  const darker = searchDirection(moving, fixed, target, 0);

  const candidates = [lighter, darker].filter((c): c is Oklch => c !== null);
  if (candidates.length === 0) {
    // Nothing at any lightness works. Report how close it is possible to get
    // rather than pretending — a caller can surface "this hue can't carry body
    // text on this background" instead of shipping a silent failure.
    const bestRatio = Math.max(
      contrastRatio({ ...moving, l: 0 }, fixed),
      contrastRatio({ ...moving, l: 1 }, fixed)
    );
    return { status: 'unreachable', bestRatio };
  }

  // Least visual disruption wins.
  candidates.sort((a, b) => Math.abs(a.l - moving.l) - Math.abs(b.l - moving.l));
  const chosen = candidates[0]!;

  // Verify rather than assume. Gamut clipping on the way to sRGB can mean the
  // rendered color is not quite the one the search converged on.
  const achievedRatio = adjustBackground
    ? contrastRatio(text, chosen)
    : contrastRatio(chosen, background);
  if (achievedRatio < target) {
    return { status: 'unreachable', bestRatio: achievedRatio };
  }

  return {
    status: 'fixed',
    color: chosen,
    hex: formatHex(chosen),
    achievedRatio,
    lightnessDelta: chosen.l - moving.l,
  };
}
