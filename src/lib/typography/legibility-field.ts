/**
 * The Legibility Solver — a colour pair plotted against every way type can be
 * set in it.
 *
 * Every tool in this category answers "does this pair pass" with one number and
 * a red or green dot. That is the wrong shape of answer, because the question a
 * designer actually has is conditional: *can I keep this colour if I bump the
 * weight?* Contrast requirements are not a property of two colours; they are a
 * property of two colours **and** how the type is set.
 *
 * So a failure stops being a red number and becomes a position on a field, with
 * the boundary drawn and the ways out visible. There are exactly three: set it
 * larger, set it heavier, or move the colour — and this module says which of
 * them are actually available for the pair in hand.
 *
 * ## Why the boundary is a step, not a curve
 *
 * WCAG's rule has two states, not a gradient: 4.5:1 for body text, 3:1 once
 * text is "large", where large means at least 24px, or at least 18.66px when
 * bold. Drawing that as a smooth curve would look more sophisticated and be a
 * lie. The real frontier is an L, and its corner — 18.66px at weight 700 — is
 * the single most useful coordinate on the whole field, because it is the one
 * place where *weight alone* changes what the pair is allowed to be.
 *
 * The consequence is worth stating plainly, and the field makes it obvious at a
 * glance: below 18.66px, no amount of weight changes anything. Thickening small
 * text is a common instinct and, as far as the standard is concerned, it does
 * nothing. Only colour helps there.
 *
 * Pure: no DOM, no React.
 */

import { apcaContrast, contrastRatio, type Oklch } from '@/lib/color-engine';
import {
  WEIGHT_STEPS,
  isLargeText,
  requiredRatio,
  suggestLegibilityFix,
  type LegibilityFix,
} from './legibility';

/**
 * Sizes the field is plotted at. Chosen to straddle both WCAG thresholds
 * rather than to be round numbers: without 18 and 20 either side of 18.66, and
 * 22 below 24, the corner of the frontier is invisible and the field implies a
 * boundary somewhere it is not.
 */
export const FIELD_SIZES: readonly number[] = [12, 14, 16, 18, 20, 22, 24, 28, 32];

export interface FieldCell {
  readonly px: number;
  readonly weight: number;
  /** 4.5 or 3, depending on whether this setting counts as large text. */
  readonly required: number;
  readonly passes: boolean;
  readonly isLarge: boolean;
}

/** The smallest size that passes at a given weight, or null if none does. */
export interface FrontierPoint {
  readonly weight: number;
  readonly minimumSize: number | null;
}

export type FieldVerdict =
  /** The pair carries body text at any size and weight. */
  | 'passes-everywhere'
  /** Only in the large-text region — the L. */
  | 'passes-when-large'
  /** No setting of type rescues this pair; only colour will. */
  | 'passes-nowhere';

export interface LegibilityField {
  readonly sizes: readonly number[];
  readonly weights: readonly number[];
  /** rows[i] is one weight, across every size. */
  readonly rows: readonly (readonly FieldCell[])[];
  /**
   * The contrast of the pair, which is the same in every cell — the field
   * varies because the *requirement* moves, not because the colours do. That
   * is the whole point and is easy to lose sight of when looking at a grid.
   */
  readonly ratio: number;
  /** APCA lightness contrast, carried as the perceptual advisory. */
  readonly apcaLc: number;
  readonly verdict: FieldVerdict;
  readonly frontier: readonly FrontierPoint[];
}

export interface FieldOptions {
  readonly sizes?: readonly number[];
  readonly weights?: readonly number[];
}

export function buildLegibilityField(
  text: Oklch,
  background: Oklch,
  options: FieldOptions = {}
): LegibilityField {
  const sizes = [...(options.sizes ?? FIELD_SIZES)].sort((a, b) => a - b);
  const weights = options.weights ?? WEIGHT_STEPS;
  const ratio = contrastRatio(text, background);

  const rows = weights.map((weight) =>
    sizes.map((px): FieldCell => {
      const required = requiredRatio(px, weight);
      return { px, weight, required, passes: ratio >= required, isLarge: isLargeText(px, weight) };
    })
  );

  const frontier = weights.map((weight, index): FrontierPoint => {
    const firstPassing = rows[index]!.find((cell) => cell.passes);
    return { weight, minimumSize: firstPassing?.px ?? null };
  });

  const cells = rows.flat();
  const passing = cells.filter((cell) => cell.passes).length;

  return {
    sizes,
    weights,
    rows,
    ratio,
    apcaLc: apcaContrast(text, background),
    verdict:
      passing === 0 ? 'passes-nowhere' : passing === cells.length ? 'passes-everywhere' : 'passes-when-large',
    frontier,
  };
}

/**
 * The ways out of a failing cell, as concrete destinations rather than advice.
 *
 * `grow` and `thicken` are null when that axis cannot rescue this pair, which
 * is the honest answer far more often than designers expect: below 18.66px no
 * weight helps at all, and if the pair is under 3:1 no setting of type helps
 * anywhere.
 */
export interface LegibilityExits {
  /** Smallest size that passes at the current weight. */
  readonly grow: number | null;
  /** Lightest weight that passes at the current size. */
  readonly thicken: number | null;
  /** Where the colour would have to move, from the existing fixer. */
  readonly recolour: LegibilityFix;
}

export function findExits(
  text: Oklch,
  background: Oklch,
  fontSizePx: number,
  fontWeight: number,
  options: FieldOptions = {}
): LegibilityExits {
  const ratio = contrastRatio(text, background);
  const sizes = [...(options.sizes ?? FIELD_SIZES)].sort((a, b) => a - b);
  const weights = options.weights ?? WEIGHT_STEPS;

  const grow =
    sizes.find((px) => px > fontSizePx && ratio >= requiredRatio(px, fontWeight)) ?? null;
  const thicken =
    weights.find((weight) => weight > fontWeight && ratio >= requiredRatio(fontSizePx, weight)) ??
    null;

  return {
    grow,
    thicken,
    recolour: suggestLegibilityFix(text, background, fontSizePx, fontWeight),
  };
}
