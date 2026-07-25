import { formatHex, maxChroma, type Oklch } from '@/lib/color-engine';

/**
 * The full 8-bit-per-channel colour space (256³ = 16,777,216 — "16.7 million
 * colours") as pure arithmetic, not stored rows. Every one of those colours
 * is 100% derivable from its own coordinates; storing them would just be
 * paying disk space and query time for numbers a formula already knows.
 *
 * The space is a 3-axis grid — lightness, hue, chroma, 256 steps each —
 * packed into a single 24-bit index, the same way RGB packs three 8-bit
 * channels into one 24-bit integer. `indexToSwatch` is O(1): no lookup
 * table, no database, just arithmetic plus the existing (tested) gamut
 * math to keep every generated colour a real, displayable sRGB value.
 *
 * Axis order defines what scrolling *feels like*, and was chosen
 * deliberately for a design/marketing audience rather than a colour
 * professional one:
 *   - **lightness is the outer (slowest-changing) axis** — scrolling moves
 *     through broad light → dark bands, which reads as "mood" the way
 *     someone picking brand colours actually thinks ("something light for
 *     the background," "something dark for the footer") — not a raw hue
 *     wheel.
 *   - **hue is the middle axis** — within a lightness band, a full rainbow
 *     sweep. Instantly recognisable, and avoids the "endless near-identical
 *     navy blues" feeling of a strictly hue-major ordering.
 *   - **chroma is the inner (fastest-changing) axis** — within one exact
 *     lightness+hue, muted → vivid.
 * Changing the "feel" of the whole spectrum is changing which axis nests
 * where below — a formula edit, not a data migration.
 */

export const SPECTRUM_STEPS = 256;
export const TOTAL_SPECTRUM_SIZE = SPECTRUM_STEPS ** 3;

/** Kept off the true 0/1 extremes — pure black/white have no meaningful hue.
 *  Exported (not just module-private) so bucket-index.ts's reverse mapping
 *  — OKLCH back to the nearest bucket — can never drift out of sync with
 *  the forward formula below by duplicating these as separate constants. */
export const LIGHTNESS_FLOOR = 0.03;
export const LIGHTNESS_CEILING = 0.97;

export interface SpectrumCoordinates {
  /** 0 = lightest, 255 = darkest. */
  readonly lightnessStep: number;
  /** 0 = 0° (red), 255 = just short of 360°. */
  readonly hueStep: number;
  /** 0 = most muted (near-neutral at this lightness/hue), 255 = most vivid. */
  readonly chromaStep: number;
}

export interface GeneratedSwatch {
  readonly index: number;
  readonly hex: string;
  readonly oklch: Oklch;
}

export function decomposeIndex(index: number): SpectrumCoordinates {
  const chromaStep = index % SPECTRUM_STEPS;
  const hueStep = Math.floor(index / SPECTRUM_STEPS) % SPECTRUM_STEPS;
  const lightnessStep = Math.floor(index / (SPECTRUM_STEPS * SPECTRUM_STEPS));
  return { lightnessStep, hueStep, chromaStep };
}

export function composeIndex(coordinates: SpectrumCoordinates): number {
  return (
    coordinates.lightnessStep * SPECTRUM_STEPS * SPECTRUM_STEPS +
    coordinates.hueStep * SPECTRUM_STEPS +
    coordinates.chromaStep
  );
}

export function indexToOklch(index: number): Oklch {
  const { lightnessStep, hueStep, chromaStep } = decomposeIndex(index);

  const lightness =
    LIGHTNESS_CEILING -
    (lightnessStep / (SPECTRUM_STEPS - 1)) * (LIGHTNESS_CEILING - LIGHTNESS_FLOOR);
  const hue = (hueStep / SPECTRUM_STEPS) * 360;
  const available = maxChroma(lightness, hue, 'srgb');
  const chroma = (chromaStep / (SPECTRUM_STEPS - 1)) * available;

  return { l: lightness, c: chroma, h: hue };
}

export function indexToSwatch(index: number): GeneratedSwatch {
  const oklch = indexToOklch(index);
  return { index, hex: formatHex(oklch), oklch };
}
