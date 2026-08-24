/**
 * Every foreground on every background, measured — and measured again through
 * four kinds of colour blindness.
 *
 * The book shipped with a list of TWO checked pairs: text on background and
 * text on surface. Those are the two that cannot be avoided, so they were the
 * right two to start with, and they are still the only two that fail the
 * build. But a designer's actual question is not "did the two required pairs
 * pass" — it is "can I put the accent on the surface here", and a guideline
 * that does not answer that sends them to a contrast checker in another tab,
 * where they will check it against a colour they typed from memory.
 *
 * So: the whole matrix, stated. Monash and PTC both print one. Ours is
 * recomputed on every render instead of being a table someone transcribed
 * once, which is the only real difference — and it is the whole difference.
 *
 * ## Why a deficiency simulation changes a contrast ratio
 *
 * WCAG contrast is a ratio of relative luminance, and simulating a deficiency
 * moves colours in a way that changes luminance — most severely under
 * achromatopsia, where two colours distinguished only by hue collapse onto the
 * same grey. A pair measuring 4.6:1 can drop under 4.5:1 for a reader with
 * deuteranopia, and nothing in a normal audit says so. That gap is
 * `cvdRegression`, and it is the finding here worth having.
 */

import { CVD_TYPES, auditContrast, simulateCvd, type CvdType } from '@/lib/color-engine';
import type { RoleAssignment, SemanticRole } from '@/lib/roles/semantic-roles';

/**
 * Roles that can carry text or a mark.
 *
 * `background` and `surface` are absent: a ground used as ink is not a pairing
 * anyone designs, and including them would double the matrix to answer a
 * question nobody asks.
 */
export const FOREGROUND_ROLES: readonly SemanticRole[] = [
  'text',
  'primary',
  'accent',
  'border',
  'onPrimary',
  'onAccent',
];

/** Roles that can be a fill something sits on. */
export const BACKGROUND_ROLES: readonly SemanticRole[] = [
  'background',
  'surface',
  'primary',
  'accent',
];

/** WCAG 2.x bands, in the order a report should try them. */
const AAA_NORMAL = 7;
const AA_NORMAL = 4.5;
const AA_LARGE = 3;

export type PairingLevel = 'AAA' | 'AA' | 'AA large' | 'fail';

export interface Pairing {
  readonly fg: SemanticRole;
  readonly bg: SemanticRole;
  readonly ratio: number;
  readonly level: PairingLevel;
  /**
   * The lowest ratio across the four simulated deficiencies.
   *
   * Not clamped to `ratio`: a simulation can read slightly HIGHER than normal
   * vision, and reporting the normal figure in that case would hide which
   * number is which. Normal vision is `ratio`; this is the simulated floor.
   */
  readonly cvdWorst: number;
  readonly cvdWorstType: CvdType;
  /** Holds AA with normal vision and loses it under some deficiency. */
  readonly cvdRegression: boolean;
}

/**
 * The pairs an interface cannot avoid using, and therefore the only ones that
 * are allowed to FAIL rather than merely be reported.
 *
 * `onPrimary`/`onAccent` are ink roles — they exist to be legible on their own
 * fill and are chosen for it, so if one of those fails, the role model itself
 * has gone wrong rather than the palette being unlucky.
 */
export const REQUIRED_PAIRS: readonly { readonly fg: SemanticRole; readonly bg: SemanticRole }[] = [
  { fg: 'text', bg: 'background' },
  { fg: 'text', bg: 'surface' },
  { fg: 'onPrimary', bg: 'primary' },
  { fg: 'onAccent', bg: 'accent' },
];

function levelOf(ratio: number): PairingLevel {
  if (ratio >= AAA_NORMAL) return 'AAA';
  if (ratio >= AA_NORMAL) return 'AA';
  if (ratio >= AA_LARGE) return 'AA large';
  return 'fail';
}

/**
 * The full matrix for a role assignment.
 *
 * Self-pairs are skipped: `primary` on `primary` measures 1:1 by definition,
 * and a row of guaranteed failures is noise that makes the real ones harder
 * to find.
 */
export function buildPairings(roles: RoleAssignment): readonly Pairing[] {
  const out: Pairing[] = [];
  for (const bg of BACKGROUND_ROLES) {
    for (const fg of FOREGROUND_ROLES) {
      if (fg === bg) continue;
      const ratio = auditContrast(roles[fg].oklch, roles[bg].oklch).ratio;

      /*
       * Seeded from the FIRST SIMULATION, not from `ratio`.
       *
       * Seeding with the deficiency-free ratio looks harmless and is not: when
       * no simulation reads worse than normal vision, `cvdWorst` keeps a value
       * no deficiency produced while `cvdWorstType` still names one — so the
       * book would print "3.26:1 under protanopia" for a number protanopia had
       * nothing to do with. The field means the lowest ratio across the four
       * simulations, and now it is only ever that.
       */
      let cvdWorstType: CvdType = CVD_TYPES[0]!;
      let cvdWorst = auditContrast(
        simulateCvd(roles[fg].oklch, cvdWorstType),
        simulateCvd(roles[bg].oklch, cvdWorstType)
      ).ratio;
      for (const type of CVD_TYPES.slice(1)) {
        const simulated = auditContrast(
          simulateCvd(roles[fg].oklch, type),
          simulateCvd(roles[bg].oklch, type)
        ).ratio;
        if (simulated < cvdWorst) {
          cvdWorst = simulated;
          cvdWorstType = type;
        }
      }

      out.push({
        fg,
        bg,
        ratio,
        level: levelOf(ratio),
        cvdWorst,
        cvdWorstType,
        cvdRegression: ratio >= AA_NORMAL && cvdWorst < AA_NORMAL,
      });
    }
  }
  return out;
}

/** One background's column, strongest contrast first. */
export function pairingsOn(
  pairings: readonly Pairing[],
  bg: SemanticRole
): readonly Pairing[] {
  return pairings.filter((p) => p.bg === bg).sort((a, b) => b.ratio - a.ratio);
}

/** Required pairs that do not reach AA for normal text. */
export function requiredFailures(pairings: readonly Pairing[]): readonly Pairing[] {
  return pairings.filter(
    (p) =>
      p.ratio < AA_NORMAL && REQUIRED_PAIRS.some((r) => r.fg === p.fg && r.bg === p.bg)
  );
}

/** Pairs that pass AA with normal vision and lose it under a deficiency. */
export function cvdRegressions(pairings: readonly Pairing[]): readonly Pairing[] {
  return pairings.filter((p) => p.cvdRegression);
}
