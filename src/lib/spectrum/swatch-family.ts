import {
  SPECTRUM_STEPS,
  composeIndex,
  decomposeIndex,
  indexToSwatch,
  type GeneratedSwatch,
} from './generate-color';

/**
 * Generates a swatch's lightness or chroma "siblings" — the same underlying
 * mechanism behind both the Library card's inline 1–10 slice stepper (a
 * quick, on-card preview) and the fuller family-tree generator in the
 * Genetics drawer (task #70). Kept here, not duplicated in each UI, since
 * both are the exact same arithmetic: hold two of generate-color.ts's three
 * axes fixed and walk the third.
 */
export type FamilyAxis = 'lightness' | 'chroma' | 'hue';

export const FAMILY_STEPS = 10;

function clampFamilyStep(step: number): number {
  return Math.min(FAMILY_STEPS, Math.max(1, Math.round(step)));
}

/**
 * `step` is 1-indexed (matching the UI's 1–10 ticks), not the raw 0–255
 * axis step generate-color.ts uses internally.
 *
 * `'hue'` is the Genetics drawer's "hue-torsion" ramp — the same mechanism
 * as lightness/chroma, just walking the hue axis instead: hold lightness
 * and chroma fixed, sweep hue across its full 0–255 step range in 10 even
 * increments, so the ramp shows the same tone twisted through every hue.
 */
export function familyStepSwatch(index: number, axis: FamilyAxis, step: number): GeneratedSwatch {
  const coordinates = decomposeIndex(index);
  const stepIndex = clampFamilyStep(step) - 1;
  const scaledAxisStep = Math.round((stepIndex / (FAMILY_STEPS - 1)) * (SPECTRUM_STEPS - 1));

  const nextCoordinates = {
    ...coordinates,
    ...(axis === 'lightness' && { lightnessStep: scaledAxisStep }),
    ...(axis === 'chroma' && { chromaStep: scaledAxisStep }),
    ...(axis === 'hue' && { hueStep: scaledAxisStep }),
  };

  return indexToSwatch(composeIndex(nextCoordinates));
}

/** The full 1–10 ramp at once — what the drawer's family-tree view renders. */
export function familyRamp(index: number, axis: FamilyAxis): readonly GeneratedSwatch[] {
  return Array.from({ length: FAMILY_STEPS }, (_, i) => familyStepSwatch(index, axis, i + 1));
}
