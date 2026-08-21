/**
 * Optical legibility: does this text actually read, at this size and weight,
 * in this color, on this background?
 *
 * Deliberately built on WCAG's own size/weight rules rather than inventing a
 * bespoke "legibility score". A made-up number would look authoritative and
 * mean nothing; WCAG's large-text threshold (≥24px, or ≥18.66px when bold) is
 * the one widely-agreed statement that size and weight change how much contrast
 * text needs, and it is what an accessibility audit will actually be measured
 * against later.
 *
 * The genuinely additive part is the fix: when text fails, thickening it can be
 * the better remedy than recoloring it, because it preserves the palette. This
 * module can recommend either.
 */

import { contrastRatio, type Oklch } from '@/lib/color-engine';
import { WCAG_AA_LARGE, WCAG_AA_NORMAL, autoFixContrast } from '@/lib/visualizer/auto-fix';

/** The CSS weights a variable font's `wght` axis is conventionally stepped at. */
export const WEIGHT_STEPS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

const BOLD_THRESHOLD = 700;
const LARGE_PX = 24;
const LARGE_BOLD_PX = 18.66;

/**
 * WCAG's "large text" rule: ≥24px, or ≥18.66px if bold. Large text is allowed
 * 3:1 instead of 4.5:1 because bigger glyphs carry more of the signal
 * themselves — which is exactly why weight is a legitimate lever here.
 */
export function isLargeText(fontSizePx: number, fontWeight: number): boolean {
  return fontSizePx >= LARGE_PX || (fontWeight >= BOLD_THRESHOLD && fontSizePx >= LARGE_BOLD_PX);
}

export function requiredRatio(fontSizePx: number, fontWeight: number): number {
  return isLargeText(fontSizePx, fontWeight) ? WCAG_AA_LARGE : WCAG_AA_NORMAL;
}

export interface LegibilityAssessment {
  readonly ratio: number;
  readonly required: number;
  readonly passes: boolean;
  readonly isLarge: boolean;
  /** How far above (positive) or below (negative) the threshold this sits. */
  readonly margin: number;
}

export function assessLegibility(
  text: Oklch,
  background: Oklch,
  fontSizePx: number,
  fontWeight: number
): LegibilityAssessment {
  const ratio = contrastRatio(text, background);
  const required = requiredRatio(fontSizePx, fontWeight);
  const isLarge = isLargeText(fontSizePx, fontWeight);
  return {
    ratio,
    required,
    passes: ratio >= required,
    isLarge,
    margin: ratio - required,
  };
}

export type LegibilityFix =
  | { readonly status: 'already-passes' }
  | {
      readonly status: 'thicken';
      readonly weight: number;
      readonly required: number;
      readonly ratio: number;
    }
  | {
      readonly status: 'recolor';
      readonly color: Oklch;
      readonly hex: string;
      readonly achievedRatio: number;
    }
  | { readonly status: 'unreachable'; readonly bestRatio: number };

/**
 * Recommends the least invasive fix for failing text.
 *
 * Thickening is preferred when it works, because it leaves the palette exactly
 * as the designer chose it — bumping to bold can cross the large-text threshold
 * and drop the requirement from 4.5:1 to 3:1 without touching a single color.
 * Recoloring is the fallback, and admitting defeat is the last resort rather
 * than returning something that still fails.
 */
export function suggestLegibilityFix(
  text: Oklch,
  background: Oklch,
  fontSizePx: number,
  fontWeight: number
): LegibilityFix {
  const current = assessLegibility(text, background, fontSizePx, fontWeight);
  if (current.passes) return { status: 'already-passes' };

  const ratio = current.ratio;

  // Can any heavier weight cross the large-text threshold and pass on its own?
  // Only meaningful when the size is already in bold-large territory; below
  // 18.66px no amount of weight changes the requirement.
  for (const weight of WEIGHT_STEPS) {
    if (weight <= fontWeight) continue;
    const needed = requiredRatio(fontSizePx, weight);
    if (ratio >= needed) {
      return { status: 'thicken', weight, required: needed, ratio };
    }
  }

  // Otherwise move the color, holding hue and chroma.
  const recolored = autoFixContrast(text, background, { target: current.required });
  if (recolored.status === 'fixed') {
    return {
      status: 'recolor',
      color: recolored.color,
      hex: recolored.hex,
      achievedRatio: recolored.achievedRatio,
    };
  }
  if (recolored.status === 'already-passes') return { status: 'already-passes' };
  return { status: 'unreachable', bestRatio: recolored.bestRatio };
}
