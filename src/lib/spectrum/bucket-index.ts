import { maxChroma, type Oklch } from '@/lib/color-engine';
import {
  LIGHTNESS_CEILING,
  LIGHTNESS_FLOOR,
  SPECTRUM_STEPS,
  composeIndex,
} from './generate-color';

/**
 * The inverse of indexToOklch: given a real, continuous OKLCH color (from
 * the curated `colors` table, or any external source), finds which of the
 * 256^3 generated-swatch buckets it falls nearest to.
 *
 * This is a *nearest-bucket* classification, not an exact round-trip — a
 * curated color's real l/c/h essentially never lands exactly on one of the
 * 256 discrete steps per axis. That's fine for what this powers (the
 * Library's semantic overlay, joining a curated row to whichever generated
 * swatch is closest to it); it would not be fine for anything claiming the
 * curated color *is* that exact generated swatch.
 *
 * Must stay the true inverse of indexToOklch's formula — the chroma step in
 * particular depends on maxChroma at this exact lightness/hue, the same way
 * indexToOklch's forward direction does, so a real color's available
 * chroma ceiling is estimated at its own (continuous) l/h rather than a
 * quantized one. That's an approximation on top of an approximation, which
 * is a reasonable trade for a fuzzy-match enrichment lookup.
 */
export function oklchToBucketIndex(color: Oklch): number {
  const lightnessStep = clampStep(
    Math.round(
      ((LIGHTNESS_CEILING - color.l) / (LIGHTNESS_CEILING - LIGHTNESS_FLOOR)) *
        (SPECTRUM_STEPS - 1)
    )
  );

  // Clamped, not wrapped: a hue just under 360 rounds to step 256, which
  // modulo would wrap back to bucket 0 — colliding with hue 0 instead of
  // landing in the actual last step, 255.
  const normalizedHue = ((color.h % 360) + 360) % 360;
  const hueStep = clampStep(Math.round((normalizedHue / 360) * SPECTRUM_STEPS));

  const available = maxChroma(color.l, color.h, 'srgb');
  const chromaStep =
    available <= 0 ? 0 : clampStep(Math.round((color.c / available) * (SPECTRUM_STEPS - 1)));

  return composeIndex({ lightnessStep, hueStep, chromaStep });
}

function clampStep(value: number): number {
  return Math.min(SPECTRUM_STEPS - 1, Math.max(0, value));
}
