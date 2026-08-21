import { deltaEOk } from './distance';
import { mapToGamut } from './gamut';
import type { Gamut, Oklch } from './types';

/**
 * Result of checking one color against one gamut. Reused for both the
 * out-of-gamut warning (target `'srgb'`, "this hex clipped from what you
 * asked for") and the print warning (target `'print'`, "this is how dull it
 * gets on paper") — same shape, same meaning, different target.
 */
export interface GamutWarning {
  readonly original: Oklch;
  /** What the color becomes once mapped into `gamut`. Equal to `original` when not clamped. */
  readonly mapped: Oklch;
  readonly clamped: boolean;
  /** Perceptual distance between original and mapped — 0 when not clamped. */
  readonly deltaEOk: number;
}

export function auditGamutWarning(color: Oklch, gamut: Gamut): GamutWarning {
  const { oklch: mapped, clamped } = mapToGamut(color, gamut);
  return {
    original: color,
    mapped,
    clamped,
    deltaEOk: clamped ? deltaEOk(color, mapped) : 0,
  };
}
