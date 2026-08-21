/**
 * Which colors stop being different when vision changes.
 *
 * The visualizer has simulated color-blindness for a while, one type at a
 * time, behind a dropdown. That answers "what does this look like to a
 * deuteranope", which is interesting, and not the question a designer needs
 * answered. The useful question is **which two of my colors just became the
 * same color** — and it cannot be answered by looking, because the whole
 * difficulty is that the person looking has normal vision.
 *
 * So this measures it. Every pair, simulated, compared in OKLab.
 *
 * ## Why retention alone is not the finding
 *
 * The obvious design — flag pairs whose distance drops — is wrong in both
 * directions, and measurement shows why:
 *
 * - `background`/`surface` in a typical dark palette sit ΔE 0.056 apart and
 *   retain 1.00 of that under every simulation. Perfect retention — and
 *   perfect retention of a difference that was already marginal is not a
 *   finding. If such a pair is too close, it was too close before anyone
 *   simulated anything, and reporting it here blames color blindness for a
 *   palette decision.
 * - A red and a green at ΔE 0.317 keep only 0.35 under deuteranopia. Same
 *   arithmetic, completely different meaning: this pair *was* distinct and
 *   the simulation destroyed it.
 *
 * A finding therefore needs both numbers: what the pair was worth, and what
 * survived. Only a pair that was distinct and is no longer counts as a
 * color-blindness problem.
 *
 * Pure: no DOM, no React.
 */

import { CVD_TYPES, deltaEOk, simulateCvd, type CvdType } from '@/lib/color-engine';
import { SEMANTIC_ROLES, type RoleAssignment, type SemanticRole } from './semantic-roles';

/**
 * Below this, two colors read as one.
 *
 * Set near the just-noticeable difference for large flat areas rather than
 * chosen for convenience. The calibration point from measurement: a dark
 * palette's background and surface sit at 0.056 and are deliberately, if
 * subtly, separable — that is what the surface role is for — so the threshold
 * has to sit below them or every well-made dark palette reports a false
 * positive on its own panels.
 */
export const MERGE_DISTANCE = 0.04;
/** Distinct enough that losing some separation is not yet a problem. */
export const COMFORTABLE_DISTANCE = 0.15;
/** Keeping less than this much of the original separation is a real loss. */
export const RETENTION_FLOOR = 0.6;

export type PairVerdict =
  /** Distinct in normal vision, indistinguishable under this simulation. */
  | 'merged'
  /** Still separable, but most of the separation is gone. */
  | 'weakened'
  /** Was never distinct to begin with — a palette problem, not this one. */
  | 'already-close'
  | 'holds';

export interface CvdPairFinding {
  readonly a: SemanticRole;
  readonly b: SemanticRole;
  /** OKLab distance in normal vision. */
  readonly normal: number;
  /** OKLab distance under the simulation. */
  readonly simulated: number;
  /** simulated / normal. Can exceed 1 — a simulation sometimes separates a
   *  pair *more* than normal vision does. */
  readonly retained: number;
  readonly verdict: PairVerdict;
}

export interface CvdTypeReport {
  readonly type: CvdType;
  /** Every pair, worst first. */
  readonly pairs: readonly CvdPairFinding[];
  readonly merged: readonly CvdPairFinding[];
  readonly weakened: readonly CvdPairFinding[];
}

export interface CvdReport {
  readonly byType: readonly CvdTypeReport[];
  /** Pairs that were never distinct — reported once, not once per vision
   *  type, because the palette is what needs changing. */
  readonly alreadyClose: readonly CvdPairFinding[];
  readonly worst: CvdPairFinding | null;
  /** True when no simulation merges or meaningfully weakens any pair. */
  readonly safe: boolean;
}

export function buildCvdReport(roles: RoleAssignment): CvdReport {
  const pairs: (readonly [SemanticRole, SemanticRole])[] = [];
  for (let i = 0; i < SEMANTIC_ROLES.length; i += 1) {
    for (let j = i + 1; j < SEMANTIC_ROLES.length; j += 1) {
      pairs.push([SEMANTIC_ROLES[i]!, SEMANTIC_ROLES[j]!]);
    }
  }

  const alreadyClose: CvdPairFinding[] = [];
  for (const [a, b] of pairs) {
    const normal = deltaEOk(roles[a].oklch, roles[b].oklch);
    if (normal < MERGE_DISTANCE) {
      alreadyClose.push({ a, b, normal, simulated: normal, retained: 1, verdict: 'already-close' });
    }
  }

  const byType = CVD_TYPES.map((type): CvdTypeReport => {
    const findings = pairs
      .map(([a, b]) => assess(a, b, roles, type))
      // A pair that was never distinct is reported once at the top level, not
      // four more times here as though each vision type broke it.
      .filter((finding) => finding.verdict !== 'already-close')
      .sort(bySeverity);

    return {
      type,
      pairs: findings,
      merged: findings.filter((f) => f.verdict === 'merged'),
      weakened: findings.filter((f) => f.verdict === 'weakened'),
    };
  });

  const flagged = byType.flatMap((report) => [...report.merged, ...report.weakened]);
  const worst = flagged.length === 0 ? null : flagged.reduce((a, b) => (bySeverity(a, b) <= 0 ? a : b));

  return { byType, alreadyClose, worst, safe: flagged.length === 0 };
}

function assess(
  a: SemanticRole,
  b: SemanticRole,
  roles: RoleAssignment,
  type: CvdType
): CvdPairFinding {
  const normal = deltaEOk(roles[a].oklch, roles[b].oklch);
  const simulated = deltaEOk(simulateCvd(roles[a].oklch, type), simulateCvd(roles[b].oklch, type));
  const retained = normal > 0 ? simulated / normal : 1;

  return { a, b, normal, simulated, retained, verdict: verdictFor(normal, simulated, retained) };
}

function verdictFor(normal: number, simulated: number, retained: number): PairVerdict {
  if (normal < MERGE_DISTANCE) return 'already-close';
  if (simulated < MERGE_DISTANCE) return 'merged';
  // A pair can shed most of its separation and still be perfectly usable if
  // it started far enough apart; complaining about that would train people to
  // ignore the panel.
  if (retained < RETENTION_FLOOR && simulated < COMFORTABLE_DISTANCE) return 'weakened';
  return 'holds';
}

/** Merged before weakened, then by how little separation survived. */
function bySeverity(a: CvdPairFinding, b: CvdPairFinding): number {
  const rank = (finding: CvdPairFinding) =>
    finding.verdict === 'merged' ? 0 : finding.verdict === 'weakened' ? 1 : 2;
  const difference = rank(a) - rank(b);
  return difference !== 0 ? difference : a.simulated - b.simulated;
}
