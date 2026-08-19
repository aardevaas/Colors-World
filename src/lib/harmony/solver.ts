/**
 * Palette generation with the contrast requirements stated up front.
 *
 * Rolling until something passes is how every tool in this category works, and
 * it puts the burden in the wrong place: the person knows what the palette has
 * to survive — body text on a card, a border that is actually visible — and
 * has no way to say so. They press a button until the numbers happen to be
 * green.
 *
 * Here the requirements are the input. You declare that text must clear 4.5:1
 * on both the page and a panel and that a border must be distinguishable from
 * the surface it sits on, and the solver moves the palette until that is true
 * or explains precisely why it cannot be.
 *
 * ## What it moves, and what it will not
 *
 * Only the neutral ladder. The brand colours are what the person chose, and
 * silently desaturating or relighting someone's brand to win a contrast
 * argument is the kind of help nobody asked for. Every neutral, by contrast,
 * exists only to serve the interface, so it is fair game — and contrast
 * between two neutrals is almost entirely a function of how far apart they sit
 * in lightness, which makes the ladder the one variable worth searching.
 *
 * ## Failing usefully
 *
 * "Six colours, every pair AA, one hue family" is frequently unsatisfiable,
 * and a solver that answers a hard question with a blank screen is worse than
 * no solver. So an unsatisfiable request comes back naming the constraint that
 * blocked it, the best ratio actually reached, and what relaxing it would
 * cost — and the best-effort palette comes back with it, because a palette
 * that misses one target by 0.3 is still worth looking at.
 */

import { contrastRatio, type Oklch } from '@/lib/color-engine';
import { deriveRoles, type RoleAssignment, type SemanticRole } from '@/lib/roles/semantic-roles';
import {
  DEFAULT_NEUTRAL_LADDER,
  generatePalette,
  type GeneratedPalette,
  type NeutralLadder,
  type PaletteOptions,
} from './palette';

export interface ContrastTarget {
  readonly foreground: SemanticRole;
  readonly background: SemanticRole;
  readonly min: number;
  /** Shown when this is the constraint that blocks a solve. */
  readonly label: string;
}

/**
 * What a usable interface actually requires, as opposed to what WCAG requires
 * of text alone. The two component-boundary targets at 3:1 come from WCAG
 * 1.4.11 and are the ones every generator in this category ignores — which is
 * why generated palettes so often produce cards you cannot see the edge of.
 */
export const DEFAULT_CONTRAST_TARGETS: readonly ContrastTarget[] = [
  { foreground: 'text', background: 'background', min: 4.5, label: 'Text on the page' },
  { foreground: 'text', background: 'surface', min: 4.5, label: 'Text on a panel' },
  { foreground: 'background', background: 'primary', min: 3, label: 'The brand against the page' },
  { foreground: 'border', background: 'surface', min: 3, label: 'A visible panel edge' },
];

export interface SolveOptions extends Omit<PaletteOptions, 'ladder'> {
  readonly targets?: readonly ContrastTarget[];
  /** Ladder to start from. Defaults to the generator's own. */
  readonly ladder?: NeutralLadder;
}

export interface UnmetTarget {
  readonly target: ContrastTarget;
  /** The best ratio reached for this pair. */
  readonly achieved: number;
  /** How far short, in ratio points. */
  readonly shortfall: number;
}

export interface SolveResult {
  /**
   * `solved` — every target met. `relaxed` — the best palette found still
   * misses at least one, and `unmet` says which. There is deliberately no
   * third "failed" state with no palette: a near miss is still worth seeing,
   * and the caller can decide whether 4.2 is close enough.
   */
  readonly status: 'solved' | 'relaxed';
  readonly palette: GeneratedPalette;
  readonly roles: RoleAssignment;
  readonly ladder: NeutralLadder;
  readonly unmet: readonly UnmetTarget[];
  /** Ladder adjustments made. Zero means the defaults already worked. */
  readonly steps: number;
}

/** Which ladder rung each role is built from. Roles absent here are brand
 *  colours, which the solver does not touch. */
const LADDER_KEY: Partial<Record<SemanticRole, keyof NeutralLadder>> = {
  background: 'background',
  surface: 'surface',
  border: 'border',
  text: 'text',
};

const MAX_STEPS = 60;
const INITIAL_STEP = 0.05;
const MIN_STEP = 0.004;
/** Neutrals stay inside this band; 0 and 1 are unusable as interface colours. */
const LIGHTNESS_BOUNDS = { min: 0.04, max: 0.985 } as const;

export function solvePalette(seed: Oklch, options: SolveOptions = {}): SolveResult {
  const targets = options.targets ?? DEFAULT_CONTRAST_TARGETS;
  const { targets: _ignored, ladder: startLadder, ...paletteOptions } = options;

  let ladder = startLadder ?? DEFAULT_NEUTRAL_LADDER;
  let step = INITIAL_STEP;
  let best = evaluate(seed, ladder, paletteOptions, targets);
  let bestLadder = ladder;
  let steps = 0;

  while (steps < MAX_STEPS && best.unmet.length > 0) {
    // Repair the single worst violation each pass rather than all of them at
    // once. Moving several rungs simultaneously overshoots and oscillates,
    // because the rungs are not independent — pushing surface down to help
    // text can break the border it sits under.
    const worst = best.unmet.reduce((a, b) => (a.shortfall > b.shortfall ? a : b));
    const moved = nudge(ladder, worst, best.roles, step);
    if (moved === null) break;

    steps += 1;
    const candidate = evaluate(seed, moved, paletteOptions, targets);

    if (totalShortfall(candidate.unmet) < totalShortfall(best.unmet)) {
      best = candidate;
      bestLadder = moved;
      ladder = moved;
    } else {
      // No improvement: the step is too coarse to fit between the constraints.
      // Halve it and try again from the best ladder so far.
      step /= 2;
      ladder = bestLadder;
      if (step < MIN_STEP) break;
    }
  }

  return {
    status: best.unmet.length === 0 ? 'solved' : 'relaxed',
    palette: best.palette,
    roles: best.roles,
    ladder: bestLadder,
    unmet: best.unmet,
    steps,
  };
}

interface Evaluation {
  readonly palette: GeneratedPalette;
  readonly roles: RoleAssignment;
  readonly unmet: readonly UnmetTarget[];
}

function evaluate(
  seed: Oklch,
  ladder: NeutralLadder,
  paletteOptions: Omit<PaletteOptions, 'ladder'>,
  targets: readonly ContrastTarget[]
): Evaluation {
  const palette = generatePalette(seed, { ...paletteOptions, ladder });
  const roles = deriveRoles(palette.colors.map((c) => ({ hex: c.hex, oklch: c.oklch })));

  const unmet: UnmetTarget[] = [];
  for (const target of targets) {
    const achieved = contrastRatio(roles[target.foreground].oklch, roles[target.background].oklch);
    if (achieved < target.min) {
      unmet.push({ target, achieved, shortfall: target.min - achieved });
    }
  }
  return { palette, roles, unmet };
}

/**
 * Moves one rung of the ladder to widen a failing pair.
 *
 * Returns null when neither side of the pair is a neutral — a target between
 * two brand colours cannot be repaired without changing what the person chose,
 * and pretending otherwise would produce a palette they did not ask for.
 */
function nudge(
  ladder: NeutralLadder,
  unmet: UnmetTarget,
  roles: RoleAssignment,
  step: number
): NeutralLadder | null {
  const fgKey = LADDER_KEY[unmet.target.foreground];
  const bgKey = LADDER_KEY[unmet.target.background];
  if (fgKey === undefined && bgKey === undefined) return null;

  const fgLightness = roles[unmet.target.foreground].oklch.l;
  const bgLightness = roles[unmet.target.background].oklch.l;
  // Push apart along the axis they already differ on. When they are level,
  // pick a direction rather than stalling: away from the middle of the range,
  // so a neutral near the floor moves down and one near the ceiling moves up.
  const fgGoesUp = fgLightness === bgLightness ? fgLightness < 0.5 : fgLightness > bgLightness;

  // Prefer moving whichever side has room left, so a rung already pinned at
  // the floor does not absorb every step and stall the search.
  const candidates: readonly (readonly [keyof NeutralLadder, number])[] = [
    ...(fgKey !== undefined ? ([[fgKey, fgGoesUp ? step : -step]] as const) : []),
    ...(bgKey !== undefined ? ([[bgKey, fgGoesUp ? -step : step]] as const) : []),
  ];

  for (const [key, delta] of candidates) {
    const next = clamp(ladder[key] + delta);
    if (next !== ladder[key]) return { ...ladder, [key]: next };
  }
  return null;
}

function totalShortfall(unmet: readonly UnmetTarget[]): number {
  return unmet.reduce((sum, entry) => sum + entry.shortfall, 0);
}

function clamp(value: number): number {
  return Math.min(LIGHTNESS_BOUNDS.max, Math.max(LIGHTNESS_BOUNDS.min, value));
}

/**
 * A sentence naming what to relax, for a request that could not be met.
 * Written here rather than in the component so the wording is testable and
 * cannot drift between the places it appears.
 */
export function describeShortfall(unmet: readonly UnmetTarget[]): string | null {
  if (unmet.length === 0) return null;
  const worst = unmet.reduce((a, b) => (a.shortfall > b.shortfall ? a : b));
  const achieved = worst.achieved.toFixed(2);
  const asked = worst.target.min.toFixed(1);
  if (unmet.length === 1) {
    return `${worst.target.label} reached ${achieved}:1, short of ${asked}:1. Try another seed, or accept ${achieved}:1.`;
  }
  return `${unmet.length} targets unmet. The binding one is ${worst.target.label.toLowerCase()} at ${achieved}:1 against ${asked}:1.`;
}
