/**
 * Every role against every other role, and which of those pairs a standard
 * actually has an opinion about.
 *
 * The visualizer has been auditing five hand-picked pairs. Five is not a
 * subset chosen for being the important ones — it is a subset chosen for
 * fitting in a sidebar, and the twenty-five it leaves out include every pair
 * that fails quietly. Text on a button is not checked. Neither is a border
 * against the page it sits on.
 *
 * A full grid on its own would only trade one problem for another: thirty
 * numbers with no indication of which ones anyone has to care about is
 * decoration, not an audit. So the grid comes with a requirement per pair,
 * and pairs nobody has a rule about are marked advisory rather than being
 * quietly scored against a threshold invented here.
 *
 * Pure: no DOM, no React.
 */

import { apcaContrast, contrastRatio } from '@/lib/color-engine';
import { SEMANTIC_ROLES, type RoleAssignment, type SemanticRole } from './semantic-roles';

/** WCAG 2.2 minimum for body text. */
export const TEXT_MINIMUM = 4.5;
/** WCAG 2.2 (1.4.11) minimum for a meaningful non-text boundary. */
export const COMPONENT_MINIMUM = 3;

export interface RoleContrast {
  readonly foreground: SemanticRole;
  readonly background: SemanticRole;
  /** WCAG 2.x ratio, 1–21. Symmetric — the compliance number. */
  readonly ratio: number;
  /** APCA lightness contrast. Directional — the perceptual advisory. */
  readonly apcaLc: number;
  /** The minimum this pair has to clear, or null when nothing requires one. */
  readonly required: number | null;
  /** False only when there is a requirement and the pair misses it. */
  readonly passes: boolean;
}

export interface RoleContrastMatrix {
  /** Row and column order, for labelling axes. */
  readonly roles: readonly SemanticRole[];
  /** rows[i][j]: role i as foreground, role j as background. */
  readonly rows: readonly (readonly RoleContrast[])[];
  /** Every pair carrying a requirement, worst first. */
  readonly required: readonly RoleContrast[];
  /** Requirements currently missed, worst first. */
  readonly failures: readonly RoleContrast[];
}

/** Roles a person reads words off. */
const SURFACES: readonly SemanticRole[] = ['background', 'surface'];
/** Roles that are painted areas something can sit on top of. */
const FILLS: readonly SemanticRole[] = ['primary', 'accent'];

/**
 * What a standard requires of this pair, or null when the pair is a
 * combination nobody builds an interface out of and inventing a threshold for
 * it would just manufacture failures.
 *
 * The direction matters: text on a surface is a requirement, and the same two
 * colors the other way round is the same measurement but not a separate rule,
 * so only the meaningful direction carries the requirement.
 */
export function requirementFor(
  foreground: SemanticRole,
  background: SemanticRole
): number | null {
  if (foreground === background) return null;

  // Body copy on the page or on a panel.
  if (foreground === 'text' && SURFACES.includes(background)) return TEXT_MINIMUM;
  /*
   * A label on a filled button is still body copy — but it is not the same
   * ink as the body copy, and requiring that it were is what made this whole
   * matrix impossible to satisfy.
   *
   * One shared `text` had to clear 4.5:1 against the page, the panel AND both
   * fills, while those fills had themselves to clear 3:1 against the page and
   * the panel. Since text is already far from the surfaces, "far from text"
   * drags a fill back TOWARD them, and the two requirements cannot both be
   * met: a scan of every fill lightness on a dark ground and on a light ground
   * finds no value that satisfies them, and a search over 120,000 random
   * assignments never scored better than one failure. Every palette anyone
   * built was going to show red, including the fallback this app ships with.
   *
   * `onPrimary` and `onAccent` are that label's own ink, derived from the fill
   * rather than shared with the body — which is what a real design system
   * does, and what makes the requirement satisfiable.
   */
  if (foreground === 'onPrimary' && background === 'primary') return TEXT_MINIMUM;
  if (foreground === 'onAccent' && background === 'accent') return TEXT_MINIMUM;
  // A filled control has to be distinguishable from what it sits on.
  if (FILLS.includes(foreground) && SURFACES.includes(background)) return COMPONENT_MINIMUM;
  // An edge has to be visible against the thing it encloses.
  if (foreground === 'border' && SURFACES.includes(background)) return COMPONENT_MINIMUM;
  // A panel has to be distinguishable from the page behind it, or the
  // interface loses its layers entirely.
  if (foreground === 'surface' && background === 'background') return COMPONENT_MINIMUM;

  return null;
}

export function buildRoleContrastMatrix(roles: RoleAssignment): RoleContrastMatrix {
  const rows = SEMANTIC_ROLES.map((foreground) =>
    SEMANTIC_ROLES.map((background): RoleContrast => {
      const ratio = contrastRatio(roles[foreground].oklch, roles[background].oklch);
      const required = requirementFor(foreground, background);
      return {
        foreground,
        background,
        ratio,
        apcaLc: apcaContrast(roles[foreground].oklch, roles[background].oklch),
        required,
        passes: required === null || ratio >= required,
      };
    })
  );

  // Worst first, measured as distance below the bar rather than raw ratio: a
  // 2.9 against a 3 is a near miss, a 2.9 against a 4.5 is not, and sorting on
  // the ratio alone would rank them the same way round.
  const required = rows
    .flat()
    .filter((cell) => cell.required !== null)
    .sort((a, b) => a.ratio - a.required! - (b.ratio - b.required!));

  return {
    roles: SEMANTIC_ROLES,
    rows,
    required,
    failures: required.filter((cell) => !cell.passes),
  };
}
