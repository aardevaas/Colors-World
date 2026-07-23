import { converter } from 'culori';
import type { ContrastReport, Oklch } from './types';
import { toCuloriOklch } from './color';

const toRgb = converter('rgb');

/* ── WCAG 2.x ─────────────────────────────────────────────────────────────
 * WCAG 2.2 did not change the contrast maths introduced in 2.0; SC 1.4.3,
 * 1.4.6 and 1.4.11 all still use this ratio. 2.2's additions (focus appearance,
 * target size) are not contrast criteria. So this function is simultaneously
 * "WCAG 2.0/2.1/2.2 contrast" — the version number is about which criteria you
 * are claiming, not about different arithmetic.
 * ────────────────────────────────────────────────────────────────────────── */

const SRGB_LINEAR_THRESHOLD = 0.04045;
const LUMINANCE_COEFFICIENTS = { r: 0.2126, g: 0.7152, b: 0.0722 } as const;
const WCAG_FLARE = 0.05;

const AA_NORMAL = 4.5;
const AAA_NORMAL = 7;
const AA_LARGE = 3;
const AAA_LARGE = 4.5;
const NON_TEXT_MINIMUM = 3;

function linearizeChannel(channel: number): number {
  const value = Math.min(1, Math.max(0, channel));
  return value <= SRGB_LINEAR_THRESHOLD
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(color: Oklch): number {
  const rgb = toRgb(toCuloriOklch(color));
  return (
    LUMINANCE_COEFFICIENTS.r * linearizeChannel(rgb.r) +
    LUMINANCE_COEFFICIENTS.g * linearizeChannel(rgb.g) +
    LUMINANCE_COEFFICIENTS.b * linearizeChannel(rgb.b)
  );
}

/** WCAG contrast ratio between two colours, 1:1 to 21:1. Order-independent. */
export function contrastRatio(a: Oklch, b: Oklch): number {
  const luminanceA = relativeLuminance(a);
  const luminanceB = relativeLuminance(b);
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + WCAG_FLARE) / (darker + WCAG_FLARE);
}

/* ── APCA ─────────────────────────────────────────────────────────────────
 * Accessible Perceptual Contrast Algorithm (W3C draft, revision 0.1.9).
 *
 * Included alongside WCAG 2.x because the 2.x ratio is known to misjudge dark
 * backgrounds — it will pass light-on-dark pairings that are genuinely hard to
 * read and fail some that are fine. APCA models this better but is NOT yet a
 * standard, so it is reported as advisory while WCAG 2.x remains the number you
 * cite for compliance.
 *
 * APCA is polarity-dependent: swapping text and background is a different
 * result, not the same one. Hence (text, background) argument order matters.
 * ────────────────────────────────────────────────────────────────────────── */

const APCA_TRC = 2.4;
const APCA_COEFFICIENTS = { r: 0.2126729, g: 0.7151522, b: 0.072175 } as const;
const APCA_BLACK_THRESHOLD = 0.022;
const APCA_BLACK_CLAMP = 1.414;
const APCA_NORMAL_BG_EXP = 0.56;
const APCA_NORMAL_TEXT_EXP = 0.57;
const APCA_REVERSE_BG_EXP = 0.65;
const APCA_REVERSE_TEXT_EXP = 0.62;
const APCA_SCALE = 1.14;
const APCA_LOW_OFFSET = 0.027;
const APCA_LOW_CLIP = 0.1;
const APCA_MIN_DELTA_Y = 0.0005;

function apcaLuminance(color: Oklch): number {
  const rgb = toRgb(toCuloriOklch(color));
  const channel = (value: number) => Math.min(1, Math.max(0, value)) ** APCA_TRC;
  return (
    APCA_COEFFICIENTS.r * channel(rgb.r) +
    APCA_COEFFICIENTS.g * channel(rgb.g) +
    APCA_COEFFICIENTS.b * channel(rgb.b)
  );
}

function softClampBlack(luminance: number): number {
  return luminance < APCA_BLACK_THRESHOLD
    ? luminance + (APCA_BLACK_THRESHOLD - luminance) ** APCA_BLACK_CLAMP
    : luminance;
}

/**
 * APCA lightness contrast (Lc). Positive for dark text on a light background,
 * negative for light text on dark. Magnitude ~15 is the invisibility floor,
 * ~60 is comfortable body-text territory, ~90 is maximal.
 */
export function apcaContrast(text: Oklch, background: Oklch): number {
  const textLuminance = softClampBlack(apcaLuminance(text));
  const backgroundLuminance = softClampBlack(apcaLuminance(background));

  if (Math.abs(backgroundLuminance - textLuminance) < APCA_MIN_DELTA_Y) {
    return 0;
  }

  if (backgroundLuminance > textLuminance) {
    const sapc =
      (backgroundLuminance ** APCA_NORMAL_BG_EXP -
        textLuminance ** APCA_NORMAL_TEXT_EXP) *
      APCA_SCALE;
    return sapc < APCA_LOW_CLIP ? 0 : (sapc - APCA_LOW_OFFSET) * 100;
  }

  const sapc =
    (backgroundLuminance ** APCA_REVERSE_BG_EXP -
      textLuminance ** APCA_REVERSE_TEXT_EXP) *
    APCA_SCALE;
  return sapc > -APCA_LOW_CLIP ? 0 : (sapc + APCA_LOW_OFFSET) * 100;
}

/** Full accessibility report for a foreground/background pairing. */
export function auditContrast(
  foreground: Oklch,
  background: Oklch
): ContrastReport {
  const ratio = contrastRatio(foreground, background);
  return {
    ratio,
    apcaLc: apcaContrast(foreground, background),
    normalText: { aa: ratio >= AA_NORMAL, aaa: ratio >= AAA_NORMAL },
    largeText: { aa: ratio >= AA_LARGE, aaa: ratio >= AAA_LARGE },
    nonText: ratio >= NON_TEXT_MINIMUM,
  };
}

/**
 * Picks whichever of two candidates reads more clearly on `background`.
 * The everyday question a palette tool has to answer: black text or white text?
 */
export function bestTextColor(
  background: Oklch,
  candidates: readonly Oklch[]
): Oklch {
  if (candidates.length === 0) {
    throw new Error('bestTextColor requires at least one candidate');
  }
  return candidates.reduce((best, candidate) =>
    contrastRatio(candidate, background) > contrastRatio(best, background)
      ? candidate
      : best
  );
}
