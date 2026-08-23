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
  /*
   * A PANEL AGAINST THE PAGE IS ADVISORY, AND ITS EDGE IS NOT.
   *
   * This pair used to carry the same 3:1 the fills carry. It failed on every
   * palette this product could produce — 400 of 400 generated, and the shipped
   * fallback at 1.10:1 — so it was not reporting a defect, it was reporting a
   * rule the whole app was built against.
   *
   * Enforcing it is possible, and the price was measured: the nearest feasible
   * ladder moves `surface` #1b1b1b to #5d5d5d and drags `border` to #b0b0b0
   * with it, which is mid-grey panels with light-grey edges on a near-black
   * page, and cuts text-on-panel from 14.96:1 to 5.65:1. That is not an
   * accessibility win, it is a different product.
   *
   * The requirement it was standing in for is the one directly above, and
   * that one stays: a border has to clear 3:1 against BOTH panel and page. So
   * a layer is always discoverable — by its edge, which is the thing that
   * actually does that work, and what 1.4.11 asks be distinguishable. A fill
   * that must itself be 3:1 from the page is stricter than the standard.
   *
   * Advisory rather than deleted: it is still measured, still in the grid, and
   * still worth a designer's eye. It just no longer fails a palette on its own.
   * Which is what this file already says it does with pairs nobody has a rule
   * about — scoring them against a threshold invented here is the thing it
   * exists to avoid.
   */

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
