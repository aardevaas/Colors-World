/**
 * Stationery as a dimensioned specification, not a picture of a card.
 *
 * The grain study is unusually specific here, because the real manuals are.
 * IRBA's business card page gives 100×50mm, a 3mm margin, the mark at 12.5mm,
 * and the name in Gotham Bold 7pt on 8.4pt leading at 100% white. That is a
 * spec a printer can work from and a designer can be held to, and it is what
 * §8 should produce — while the founder's own constraint is equally clear:
 * **visualisation only, no dielines and no production artwork.** Those are not
 * in tension. A dieline is a cutting template; a dimensioned spec is the rule.
 *
 * ## What is stated, and what is deliberately not
 *
 * Stated, because each has a source or is arithmetic:
 *
 * - **The format**, from the ISO standard that defines it.
 * - **The brand's own type ladder in points and millimetres** — the same
 *   ladder §4 prints in rem, converted, because nobody sets a business card in
 *   rem and the conversion is where the mistake gets made.
 * - **Ink and ground**, from the role model.
 * - **Whether the licence permits print at all**, from the catalogue.
 *
 * NOT stated: margins, mark size, and grid. IRBA has a 3mm margin on a 50mm
 * edge and Monash has something else on a different card, and there is no
 * standard behind any of it — it is a design decision each brand makes. This
 * module would have to invent a rule and then present it with the same
 * confidence as ISO 216, which is the one thing the book must never do. They
 * are a brand's to declare, and the component says so rather than guessing.
 */

import { licenceOf } from '@/lib/typography/font-catalogue';
import { ROOT_PX, buildScale, type ScaleToken } from '@/lib/typography/type-scale';
import { systemRoles } from './colour';
import { faceFor } from './typography';
import type { BrandState } from './types';

/** Millimetres per point: 25.4mm to the inch, 72 points to the inch. */
const MM_PER_PT = 25.4 / 72;
/** Points per CSS pixel: 72 points to the inch over 96 pixels to the inch. */
const PT_PER_PX = 72 / 96;

export function ptToMm(pt: number): number {
  return pt * MM_PER_PT;
}

/**
 * The smallest type that survives being printed, in points.
 *
 * A practitioner floor, NOT a standard — there is no ISO minimum for body
 * text on a business card. Stated here as one number so the book can be
 * checked against it rather than each component carrying its own opinion, and
 * labelled `declared` wherever it is shown.
 */
export const PRINT_FLOOR_PT = 8;

export interface StationeryFormat {
  readonly id: 'business-card' | 'letterhead' | 'envelope';
  readonly name: string;
  readonly widthMm: number;
  readonly heightMm: number;
  /** The standard the dimensions come from. Every one of these is real. */
  readonly standard: string;
}

export const STATIONERY: readonly StationeryFormat[] = [
  {
    id: 'business-card',
    name: 'Business card',
    widthMm: 85.6,
    heightMm: 53.98,
    standard: 'ISO/IEC 7810 ID-1 — the same format as a bank card, which is why it fits a wallet.',
  },
  {
    id: 'letterhead',
    name: 'Letterhead',
    widthMm: 210,
    heightMm: 297,
    standard: 'ISO 216 A4.',
  },
  {
    id: 'envelope',
    name: 'Envelope',
    widthMm: 220,
    heightMm: 110,
    standard: 'ISO 269 DL — takes an A4 sheet folded in three.',
  },
];

export interface LadderRung {
  readonly token: ScaleToken;
  readonly pt: number;
  readonly mm: number;
}

export interface PrintLicenceVerdict {
  readonly name: string;
  readonly allowed: boolean;
}

export interface StationerySpec {
  readonly format: StationeryFormat;
  /** The brand's type ladder, converted for print. */
  readonly ladder: readonly LadderRung[];
  readonly ink: string;
  readonly ground: string;
  readonly printLicence?: PrintLicenceVerdict;
}

/** Two decimals: finer than a printer can hold, and coarser is a lie. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The spec for each piece, from the System.
 *
 * The ladder is identical across the three, and that is the point rather than
 * a redundancy: the brand has ONE type scale, and a card that quietly uses
 * sizes the letterhead does not is how a system stops being one.
 */
export function stationerySpecs(state: BrandState): readonly StationerySpec[] {
  const { type } = state.system;
  const ladder: readonly LadderRung[] = buildScale(type.baseRem, type.ratio).map((rung) => {
    const pt = round2(rung.rem * ROOT_PX * PT_PER_PX);
    return { token: rung.token, pt, mm: round2(ptToMm(pt)) };
  });

  const roles = systemRoles(state.system);
  const body = faceFor(state, 'body');
  const licence = body.id === null ? null : licenceOf(body.id);

  return STATIONERY.map((format) => ({
    format,
    ladder,
    ink: roles.text.hex,
    ground: roles.background.hex,
    ...(licence === null
      ? {}
      : { printLicence: { name: licence.name, allowed: licence.print } }),
  }));
}

/** Rungs that set below the print floor. */
export function underPrintFloor(ladder: readonly LadderRung[]): readonly LadderRung[] {
  return ladder.filter((rung) => rung.pt < PRINT_FLOOR_PT);
}

/* ---------------------------------------------------------------- signage */

/**
 * Cap height to viewing distance, as the sign trade states it.
 *
 * One inch of capital letter height per ten feet of viewing distance — 25.4mm
 * per 3048mm, so **1:120**. It is the most widely published figure in the
 * signage industry and it is NOT a standard: every source that gives it also
 * says it is a starting point, because typeface, contrast, viewing angle and
 * lighting all move the real answer. Stated here as `declared` with that
 * caveat attached, exactly as the email floor is, rather than dressed up as a
 * specification.
 *
 * (ADA does regulate character height for interior signs, and the US Access
 * Board publishes legibility research for variable message signs. Neither is
 * this rule, and neither is quoted here — a regulation half-remembered is
 * worse than a rule of thumb honestly labelled.)
 */
export const CAP_HEIGHT_TO_DISTANCE = 1 / 120;

/** The distances a wayfinding scheme actually gets specified at, in metres. */
export const SIGN_DISTANCES_M: readonly number[] = [3, 10, 30, 100];

export interface SignSize {
  readonly distanceM: number;
  /** Minimum capital-letter height, in millimetres. */
  readonly capHeightMm: number;
}

/**
 * Minimum cap height at each viewing distance.
 *
 * Cap height, not font size — the rule is about the letter, and a face's
 * cap height is some fraction of its em (commonly around 0.7, but it is a
 * per-face metric the open catalogue does not carry). So this is the height
 * the letters must reach; the size that achieves it has to be set against the
 * face rather than computed from it, and the component says so.
 */
export function signSizes(): readonly SignSize[] {
  return SIGN_DISTANCES_M.map((distanceM) => ({
    distanceM,
    capHeightMm: round2(distanceM * 1000 * CAP_HEIGHT_TO_DISTANCE),
  }));
}
