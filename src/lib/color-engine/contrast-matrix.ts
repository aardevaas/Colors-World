import { apcaContrast, contrastRatio } from './contrast';
import type { ScaleStep } from './types';

/**
 * The /builder Contrast Matrix heatmap's underlying data: every step of a
 * scale checked against every other step, both as potential text and as
 * potential background.
 *
 * WCAG's contrast ratio is order-independent (contrastRatio(a, b) ===
 * contrastRatio(b, a)) — swapping foreground/background never changes the
 * legally-cited number. APCA is NOT: it models how light-on-dark and
 * dark-on-light read differently to the eye, so apcaContrast(text,
 * background) and apcaContrast(background, text) are genuinely different
 * values, not a simple sign flip of each other (see contrast.ts's own note
 * on the different exponents for "normal" vs "reverse" polarity). A row/
 * column matrix over N steps is therefore N² *distinct* APCA readings, not
 * the N(N-1)/2 + diagonal a symmetric metric would need — `textStep` and
 * `backgroundStep` are named explicitly on every cell so a consumer can
 * never accidentally render it transposed.
 */
export interface ContrastCell {
  readonly textStep: number;
  readonly backgroundStep: number;
  /** WCAG 2.x contrast ratio, 1–21. Symmetric — the compliance number. */
  readonly ratio: number;
  /** APCA lightness contrast. Directional — the perceptual advisory. */
  readonly apcaLc: number;
}

export interface ContrastMatrix {
  /** Step indices in row/column order, for labeling axes in the UI. */
  readonly stepIndices: readonly number[];
  /** rows[i][j]: row i's step used as TEXT, column j's step as BACKGROUND. */
  readonly rows: readonly (readonly ContrastCell[])[];
}

export function buildContrastMatrix(steps: readonly ScaleStep[]): ContrastMatrix {
  const stepIndices = steps.map((step) => step.step);

  const rows = steps.map((textStep) =>
    steps.map(
      (backgroundStep): ContrastCell => ({
        textStep: textStep.step,
        backgroundStep: backgroundStep.step,
        ratio: contrastRatio(textStep.oklch, backgroundStep.oklch),
        apcaLc: apcaContrast(textStep.oklch, backgroundStep.oklch),
      })
    )
  );

  return { stepIndices, rows };
}
