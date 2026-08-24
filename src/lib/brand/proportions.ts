/**
 * How much of a surface each colour role actually covers.
 *
 * THE PRIMITIVE NOBODY ELSE HAS, and the reason is worth stating because it
 * explains the shape of everything below. IRBA's manual states primary 50% /
 * secondary 20% / accent 20%. Regus states 60/20/10/5/5. Monash mandates a
 * minimum 25% primary across all audiences. Three serious manuals, three
 * stated ratios — and not one of them can check whether a given layout obeys
 * the rule it just stated. "This surface is 8% primary against your 25% floor"
 * is arithmetic, and it is unclaimed.
 *
 * ## Why this is not a screenshot
 *
 * The obvious implementation samples pixels. It was considered and rejected:
 * sampling a live URL cannot be done in a browser at all (a cross-origin
 * iframe taints the canvas, so `getImageData` throws — a security boundary,
 * not a difficulty), and doing it server-side means a headless browser and an
 * SSRF surface. More importantly it would be *approximate*, and this number is
 * about to be used to tell someone their layout breaks their own rule.
 *
 * So proportions are computed from **declared geometry**: a surface is a list
 * of rectangles, each carrying the role that fills it, painted in order. That
 * is exact, deterministic, needs no browser, runs on the server inside the
 * Book, and can be unit tested — the same reason the visualiser's templates
 * declare `data-audit-fg`/`data-audit-bg` beside their markup instead of
 * inferring roles from computed styles.
 *
 * ## Compositing, not area
 *
 * The first version summed rectangle areas and it was wrong in a way that
 * mattered. The editorial hero carries a primary radial glow over roughly 72%
 * of the frame; counted as flat area it is either 72% primary (it is plainly
 * not — the glow is mostly transparent) or 0% (it was, because the fill is a
 * `background-image`). Both numbers are confidently false, which is the exact
 * failure this product exists to avoid.
 *
 * So every region carries an `alpha`: the fraction of its own rectangle it
 * actually contributes. Coverage is then front-to-back compositing — each
 * region takes `alpha` of whatever visibility is still unspent, and passes the
 * rest down. Flat fills are `alpha: 1` and behave exactly as area. A gradient
 * or a translucent overlay states the mean alpha its CSS produces, worked out
 * once where the region is declared.
 */

import { SEMANTIC_ROLES, type SemanticRole } from '@/lib/roles/semantic-roles';
import type { ProportionTarget, RoleTarget } from '@/lib/system/types';

/** Where a surface is meant to be seen. Channels have different rules. */
export type SurfaceChannel = 'web' | 'mobile' | 'email' | 'presentation' | 'print';

/**
 * One filled rectangle, in coordinates normalised to the surface (0…1).
 *
 * Normalised rather than pixels so a measurement does not silently become a
 * claim about one viewport: the ratio between a sidebar and a main column is
 * the thing being stated, and it survives a resize that a pixel count does not.
 */
export interface Region {
  readonly role: SemanticRole;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /**
   * How much of its own rectangle this fill actually contributes, 0…1.
   *
   * 1 (the default) is a flat opaque fill. Anything less is a gradient or a
   * translucent layer, and the region should carry a `note` saying how the
   * number was derived — an unexplained 0.34 is indistinguishable from a guess.
   */
  readonly alpha?: number;
  readonly note?: string;
}

export interface Surface {
  readonly id: string;
  readonly name: string;
  readonly channel: SurfaceChannel;
  /** Painted in order: later regions sit over earlier ones. */
  readonly regions: readonly Region[];
  /** When the geometry was taken off the rendered template. */
  readonly measuredAt: string;
  /** The viewport it was taken at, since a responsive layout has more than one. */
  readonly measuredViewport: string;
}

export type RoleCoverage = Partial<Record<SemanticRole, number>>;

/** Distinct coordinates bounding the cells, clipped to the unit surface. */
function edges(values: readonly number[]): readonly number[] {
  const inside = [...new Set([0, 1, ...values])].filter((v) => v >= 0 && v <= 1);
  return inside.sort((a, b) => a - b);
}

/**
 * The fraction of the surface each role covers.
 *
 * Coordinate compression, then front-to-back compositing per cell. Every
 * region edge becomes a grid line, so within any one cell the set of covering
 * regions is constant and the cell can be resolved once — which makes this
 * exact rather than sampled, at the cost of being O(cells × regions). Surfaces
 * carry tens of regions, not thousands, so that is the right trade.
 *
 * Returns fractions, not percentages, and they sum to at most 1. A surface
 * whose regions do not cover it returns less than 1 rather than inflating
 * something to fill the gap: an unpainted surface is a real state and the
 * honest report of it is a total below 100%.
 */
export function coverage(surface: Surface): RoleCoverage {
  const { regions } = surface;
  if (regions.length === 0) return {};

  const xs = edges(regions.flatMap((r) => [r.x, r.x + r.w]));
  const ys = edges(regions.flatMap((r) => [r.y, r.y + r.h]));

  const acc: Record<string, number> = {};

  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i]!;
    const x1 = xs[i + 1]!;
    const cx = (x0 + x1) / 2;
    for (let j = 0; j < ys.length - 1; j++) {
      const y0 = ys[j]!;
      const y1 = ys[j + 1]!;
      const cy = (y0 + y1) / 2;
      const cellArea = (x1 - x0) * (y1 - y0);
      if (cellArea <= 0) continue;

      // Front to back: each region spends `alpha` of what visibility is left.
      let remaining = 1;
      for (let k = regions.length - 1; k >= 0 && remaining > 0; k--) {
        const r = regions[k]!;
        if (cx < r.x || cx > r.x + r.w || cy < r.y || cy > r.y + r.h) continue;
        const alpha = r.alpha ?? 1;
        if (alpha <= 0) continue;
        const taken = remaining * Math.min(alpha, 1);
        acc[r.role] = (acc[r.role] ?? 0) + cellArea * taken;
        remaining -= taken;
      }
    }
  }

  const out: RoleCoverage = {};
  for (const role of SEMANTIC_ROLES) {
    const v = acc[role];
    if (v !== undefined && v > 0) out[role] = v;
  }
  return out;
}

/*
 * `RoleTarget` and `ProportionTarget` are defined in `lib/system/types.ts`,
 * not here. The target is a rule the person states about their brand, so it
 * belongs in the System and travels in the link; this module only checks it.
 * Re-exported so a caller needs one import rather than two.
 */
export type { ProportionTarget, RoleTarget };

export type ProportionVerdict = 'under' | 'within' | 'over';

export interface ProportionRow {
  readonly role: SemanticRole;
  /** Fraction of the surface, 0…1. */
  readonly measured: number;
  readonly target: RoleTarget;
  readonly verdict: ProportionVerdict;
  /** Signed distance from the nearest bound, 0 when inside. */
  readonly delta: number;
}

/**
 * Measured coverage against a stated target, one row per targeted role.
 *
 * Iterates the TARGET, not the measurement. A role the layout never uses is
 * the single most important row in the table — "you said at least a quarter
 * primary and this surface has none" — and iterating what was measured would
 * silently drop exactly that case.
 */
export function compareToTarget(
  measured: RoleCoverage,
  target: ProportionTarget
): readonly ProportionRow[] {
  const rows: ProportionRow[] = [];
  for (const [role, bound] of Object.entries(target) as [SemanticRole, RoleTarget][]) {
    const value = measured[role] ?? 0;
    const verdict: ProportionVerdict =
      value < bound.min ? 'under' : bound.max !== undefined && value > bound.max ? 'over' : 'within';
    const delta =
      verdict === 'under'
        ? value - bound.min
        : verdict === 'over'
          ? value - (bound.max as number)
          : 0;
    rows.push({ role, measured: value, target: bound, verdict, delta });
  }
  return rows;
}

/** A fraction as a percentage string, at the one decimal a ratio deserves. */
export function asPercent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}
