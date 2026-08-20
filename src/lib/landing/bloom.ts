/**
 * One colour, blown open into a whole system.
 *
 * This is the landing page's central trick, and it is deliberately not a
 * trick: the visitor picks one colour off the globe, and the page answers
 * with the six-colour system that colour implies — the same generator, the
 * same role model, the same contrast measurements the five rooms use. What
 * the page then renders itself in is the result. Nothing is mocked up.
 *
 * The one piece of real work here beyond wiring is choosing the harmony. A
 * fixed rule would be cheaper, and for most seeds it would be a worse system:
 * complementary is excellent for some hues and produces an unusable accent for
 * others. So all seven rules are generated, each is measured against the same
 * WCAG requirements the Visualizer applies, and the best one wins. That is the
 * product's whole argument — measure, then choose — performed once, in about a
 * millisecond, on a colour the visitor picked a second ago.
 *
 * Pure: no DOM, no React.
 */

import {
  contrastRatio,
  isInGamut,
  mapToGamut,
  maxChroma,
  parseColor,
  type Gamut,
  type Oklch,
} from '@/lib/color-engine';
import { HARMONY_RULES, type HarmonyRule } from '@/lib/harmony/harmony';
import {
  DEFAULT_NEUTRAL_LADDER,
  type NeutralLadder,
  type PaletteColor,
} from '@/lib/harmony/palette';
import { solvePalette } from '@/lib/harmony/solver';
import { buildRoleContrastMatrix } from '@/lib/roles/role-contrast';
import { deriveRoles, type RoleAssignment } from '@/lib/roles/semantic-roles';
import { encodeSystem } from '@/lib/system/codec';
import { EMPTY_SYSTEM } from '@/lib/system/defaults';
import type { System, SystemColor } from '@/lib/system/types';

/** Six, because that is what the role model needs to fill every role from
 *  distinct colours. Fewer works, and the Library says so; the landing page
 *  should show the product at its full width. */
export const BLOOM_SIZE = 6;

/** What an unparseable `?seed=` falls back to, so the page never blanks. */
export const FALLBACK_SEED = '#7C5CFF';

export interface Bloom {
  /** The colour as it will be shown back to the visitor. */
  readonly seedHex: string;
  /** False when the requested seed could not be parsed and this is the
   *  fallback system — the page can then skip "here is *your* colour". */
  readonly seedUsable: boolean;
  readonly rule: HarmonyRule;
  readonly colors: readonly SystemColor[];
  readonly system: System;
  readonly roles: RoleAssignment;
  /** Required pairs that miss their threshold. Zero is the good case. */
  readonly failures: number;
  readonly requiredPairs: number;
  /** The weakest required pair's measured ratio. */
  readonly weakestRatio: number;
}

export interface BloomOptions {
  /** Force a harmony instead of searching for the best one. */
  readonly rule?: HarmonyRule;
}

export function bloomFrom(seed: string, options: BloomOptions = {}): Bloom {
  const parsed = tryParse(seed);
  const seedOklch = parsed ?? parseColor(FALLBACK_SEED);
  const seedHex = parsed === null ? FALLBACK_SEED : normaliseHex(seed);

  const rules = options.rule === undefined ? HARMONY_RULES : [options.rule];
  // Both ladders, every rule. The two ladders fail in opposite directions --
  // measured across nine seeds, the generator's own ladder scores better on
  // chromatic seeds (32 failures against 35) and the constructed one is
  // strictly better on the achromatic ones, where a near-grey seed leaves the
  // brand colours with nowhere to sit. Searching both costs fourteen solves,
  // about a millisecond, and beats either alone (29).
  const ladders: readonly (NeutralLadder | undefined)[] = [
    DEFAULT_NEUTRAL_LADDER,
    buildLegibleLadder(seedOklch.h, LADDER_NEUTRAL_CHROMA, 'srgb'),
  ];
  const candidates = rules.flatMap((rule) =>
    ladders.map((ladder) => build(seedHex, seedOklch, rule, ladder))
  );

  return {
    ...best(candidates),
    seedUsable: parsed !== null,
  };
}

/** The two numbers a bloom is judged on, in priority order: fewer failures
 *  first, then a higher floor under the pairs that do carry a requirement. */
export function scoreOf(bloom: Bloom): { failures: number; weakestRatio: number } {
  return { failures: bloom.failures, weakestRatio: bloom.weakestRatio };
}

/** The query string that reopens this system in any room. */
export function bloomQuery(bloom: Bloom): string {
  return encodeSystem(bloom.system);
}

/** Where the ladder starts from the bottom. Not 0: a true black page has no
 *  headroom left for three more rungs above it. */
const LADDER_FLOOR = 0.13;
/** The generator's own neutral chroma. Mirrored rather than imported because
 *  it is private there; the ladder only needs it to place the rungs, and the
 *  generator remains the one that actually builds the colours. */
const LADDER_NEUTRAL_CHROMA = 0.012;
/** Resolution of the ladder scan. 0.002 in OKLCH lightness is finer than an
 *  8-bit hex channel can represent, so nothing is lost by stopping here. */
const LADDER_STEP = 0.002;
const LADDER_CEILING = 0.985;

/**
 * A neutral ladder whose rungs are far enough apart to satisfy the chain.
 *
 * The generator's default ladder puts background, surface and border within
 * ~1.2:1 of each other, which fails three of the Visualizer's own requirements
 * on every seed — measured, and identical across all seven harmonies, because
 * it is a property of the ladder rather than of the colour.
 *
 * The solver cannot repair it. Its hill-climb accepts a move only when total
 * shortfall drops, and every single move here makes something else worse:
 * lifting `surface` away from `background` closes the gap to `border`. So it
 * halves its step, finds no improvement, and returns the ladder it started
 * with. That is a local minimum, not an impossibility — the chain is
 * comfortably satisfiable (black-to-white affords 21:1, and the chain needs
 * about 13.5:1), it just is not reachable one repair at a time.
 *
 * So this constructs the answer instead of searching for it. Each rung is the
 * lowest lightness that clears its own requirement against the rungs already
 * fixed below it, which is well defined because contrast against a fixed
 * darker colour rises monotonically with lightness. Lowest rather than
 * comfortable on purpose: every bit of headroom spent here is headroom the
 * rung above no longer has.
 */
export function buildLegibleLadder(hue: number, chroma: number, gamut: Gamut): NeutralLadder {
  const background = LADDER_FLOOR;
  const luminanceOf = (l: number) => neutralAt(l, hue, chroma, gamut);

  const surface = climbUntil(background, (l) =>
    contrastRatio(luminanceOf(l), luminanceOf(background)) >= 3
  );
  const border = climbUntil(surface, (l) =>
    contrastRatio(luminanceOf(l), luminanceOf(surface)) >= 3
  );
  const text = climbUntil(
    border,
    (l) =>
      contrastRatio(luminanceOf(l), luminanceOf(background)) >= 4.5 &&
      contrastRatio(luminanceOf(l), luminanceOf(surface)) >= 4.5
  );

  return { background, surface, border, text };
}

/** The lowest lightness above `from` that satisfies `ok`, or the ceiling when
 *  nothing does — a ladder that cannot be built is still better returned than
 *  thrown, because the audit downstream will say so plainly. */
function climbUntil(from: number, ok: (l: number) => boolean): number {
  for (let l = from + LADDER_STEP; l <= LADDER_CEILING; l += LADDER_STEP) {
    if (ok(l)) return Number(l.toFixed(3));
  }
  return LADDER_CEILING;
}

function neutralAt(l: number, hue: number, chroma: number, gamut: Gamut): Oklch {
  const candidate: Oklch = { l, c: Math.min(chroma, maxChroma(l, hue, gamut)), h: hue };
  return isInGamut(candidate, gamut) ? candidate : mapToGamut(candidate, gamut).oklch;
}

function build(
  seedHex: string,
  seedOklch: Oklch,
  rule: HarmonyRule,
  ladder: NeutralLadder | undefined
): Bloom {
  // Solved rather than merely generated: the solver's default targets move
  // the ladder until text and a panel edge hold, which takes the average
  // palette from five failing pairs to three.
  const solved = solvePalette(seedOklch, { rule, count: BLOOM_SIZE, ladder });
  // Substitution is confined to a brand slot, so every ladder guarantee the
  // solver just established survives it untouched.
  const withSeed = substituteSeed(solved.palette.colors, seedHex, seedOklch);

  const colors: SystemColor[] = withSeed.map((color, index) => ({
    hex: color.hex,
    oklch: color.oklch,
    addedAt: index,
  }));

  const roles = deriveRoles(colors.map(({ hex, oklch }) => ({ hex, oklch })));
  const matrix = buildRoleContrastMatrix(roles);

  const system: System = {
    ...EMPTY_SYSTEM,
    palette: colors,
    anchorHex: seedHex,
  };

  return {
    seedHex,
    seedUsable: true,
    rule,
    colors,
    system,
    roles,
    failures: matrix.failures.length,
    requiredPairs: matrix.required.length,
    weakestRatio: matrix.required.reduce(
      (lowest, pair) => Math.min(lowest, pair.ratio),
      Number.POSITIVE_INFINITY
    ),
  };
}

/**
 * Put the colour the visitor actually picked into the palette it grew.
 *
 * The generator places brand colours at a fixed lightness so they read as
 * brand against the neutral ladder, which means the seed's own hex is not in
 * its own palette — and a page that answers "here is your system" without the
 * colour you chose in it is not showing you your system.
 *
 * The substitution is confined to a brand slot on purpose. The neutrals are
 * what guarantee text is readable on the background; swapping one of those for
 * an arbitrary picked colour would trade the page's legibility for a nicety.
 */
function substituteSeed(
  colors: readonly PaletteColor[],
  seedHex: string,
  seedOklch: Oklch
): readonly PaletteColor[] {
  const already = colors.some((color) => color.hex.toLowerCase() === seedHex.toLowerCase());
  if (already) return colors;

  let target = -1;
  let closest = Number.POSITIVE_INFINITY;
  colors.forEach((color, index) => {
    if (color.origin !== 'harmony') return;
    const distance = hueDistance(color.oklch.h, seedOklch.h);
    if (distance < closest) {
      closest = distance;
      target = index;
    }
  });
  if (target === -1) return colors;

  const replaced = colors.map((color, index) =>
    index === target ? { oklch: seedOklch, hex: seedHex, origin: color.origin } : color
  );

  // A substitution that collapses two entries onto one hex would hand the
  // role model five colours for six roles, which is the exact shape of the
  // collision bug the role model now defends against. Keep the generated
  // palette in that case: the seed appearing is worth less than the system
  // being whole.
  const distinct = new Set(replaced.map((color) => color.hex.toLowerCase()));
  return distinct.size === replaced.length ? replaced : colors;
}

function best(candidates: readonly Bloom[]): Bloom {
  return candidates.reduce((winner, candidate) => {
    if (candidate.failures !== winner.failures) {
      return candidate.failures < winner.failures ? candidate : winner;
    }
    // Ties are broken by the floor rather than the average: one unreadable
    // pair is what a person notices, not a good mean.
    return candidate.weakestRatio > winner.weakestRatio ? candidate : winner;
  });
}

function tryParse(input: string): Oklch | null {
  try {
    return parseColor(input);
  } catch {
    return null;
  }
}

function normaliseHex(input: string): string {
  const trimmed = input.trim();
  return trimmed.startsWith('#') ? trimmed.toLowerCase() : `#${trimmed.toLowerCase()}`;
}

function hueDistance(a: number, b: number): number {
  const raw = Math.abs(a - b) % 360;
  return raw > 180 ? 360 - raw : raw;
}

/** How readable the page this bloom paints actually is, for the receipt. */
export function bloomTextContrast(bloom: Bloom): number {
  return contrastRatio(bloom.roles.text.oklch, bloom.roles.background.oklch);
}
