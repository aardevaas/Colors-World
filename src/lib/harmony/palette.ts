/**
 * One color in, a usable palette out.
 *
 * `generateHarmony` answers "what colors are related to this one", which is
 * the classical question, and on its own it does not produce something you can
 * build an interface from. A triad is three vivid mid-tones: a lovely swatch
 * strip and an unusable UI, because there is no ground to sit on, no panel
 * above it, and nothing that reads as text.
 *
 * So a palette is a harmony *plus* the lightness range an interface needs. The
 * neutrals are built from the seed's own hue at very low chroma rather than
 * from dead grey — a trace of the brand carried through the greys is most of
 * what separates a system that looks designed from one that looks like a
 * template, and it costs nothing to compute.
 *
 * The shape is chosen so the shared role model (`deriveRoles`) has exactly the
 * material it looks for: two dark tinted neutrals for background and surface, a
 * light one for text, a mid one for border, and the harmony's colors for
 * primary and accent. Those assignments are asserted in the tests rather than
 * assumed here — this module does not know about roles, and should not.
 */

import { formatHex, isInGamut, mapToGamut, maxChroma, type Gamut, type Oklch } from '@/lib/color-engine';
import { generateHarmony, type ChromaStrategy, type Harmony, type HarmonyRule } from './harmony';

/** Sizes the generator is defined for. Six is what a UI actually needs. */
export const PALETTE_SIZES: readonly number[] = [3, 4, 5, 6, 7, 8];
const MIN_SIZE = 3;
const MAX_SIZE = 8;
const DEFAULT_SIZE = 6;

/** How much of the seed's hue bleeds into the greys. */
const DEFAULT_NEUTRAL_CHROMA = 0.012;

/** Neutrals are held to a fraction of the least chromatic brand color. */
const NEUTRAL_CHROMA_HEADROOM = 0.5;

/** Brand slots the ladder can use, so a short harmony knows how far to fill. */
const MAX_BRAND_SLOTS = 4;

/**
 * Lightness the interface neutrals sit at, dark-polarity. Light palettes come
 * from `flipPolarity` on the resolved roles rather than a second generator, so
 * there is one ladder to reason about instead of two.
 */
export interface NeutralLadder {
  readonly background: number;
  readonly surface: number;
  readonly border: number;
  readonly text: number;
}

/**
 * `border` sits at 0.53 rather than the 0.34 it shipped with.
 *
 * At 0.34 the edge measured 1.47:1 against the panel and 1.67:1 against the
 * page — an invisible border on the app's own default palette, which is the
 * exact defect the solver was written to fix and could not, because it starts
 * from here. 0.53 clears 3:1 on both with about ten percent of headroom, which
 * is enough to survive rounding to six-digit hex and the solver's own nudges
 * without flipping a verdict.
 *
 * Only this rung moves. Background, surface and text keep the values the
 * product was designed around; see `requirementFor` in roles/role-contrast for
 * why lifting `surface` to satisfy panel-against-page was rejected.
 */
export const DEFAULT_NEUTRAL_LADDER: NeutralLadder = {
  background: 0.15,
  surface: 0.22,
  border: 0.53,
  text: 0.95,
};

/** Where harmony colors are placed so they read as brand against the ladder. */
const BRAND_LIGHTNESS = 0.62;

/**
 * Lightnesses used to extend a harmony that does not supply enough colors.
 * `monochromatic` is one hue by definition, so a monochromatic *palette* has
 * to be built from tones of it -- which is exactly what the word means to a
 * designer, and what the hue-only harmony cannot express on its own.
 */
const TONAL_LIGHTNESSES: readonly number[] = [0.50, 0.74, 0.42];

export type ColorOrigin = 'harmony' | 'neutral';

export interface PaletteColor {
  readonly oklch: Oklch;
  readonly hex: string;
  readonly origin: ColorOrigin;
}

export interface PaletteOptions {
  readonly rule?: HarmonyRule;
  readonly gamut?: Gamut;
  readonly chroma?: ChromaStrategy;
  readonly count?: number;
  /** Chroma carried by the neutrals. Zero gives true greys. */
  readonly neutralChroma?: number;
  readonly spread?: number;
  /**
   * Lightness of each neutral slot. Exposed because it is what the constraint
   * solver moves: contrast between two neutrals is almost entirely a function
   * of how far apart they sit on this ladder, so it is the one set of numbers
   * worth searching over.
   */
  readonly ladder?: NeutralLadder;
}

export interface GeneratedPalette {
  readonly colors: readonly PaletteColor[];
  /** The harmony underneath, so an interface can explain where this came from. */
  readonly harmony: Harmony;
}

export function generatePalette(seed: Oklch, options: PaletteOptions = {}): GeneratedPalette {
  const gamut = options.gamut ?? 'srgb';
  const rule = options.rule ?? 'triad';
  const count = clampCount(options.count ?? DEFAULT_SIZE);
  const neutralChroma = Math.max(0, options.neutralChroma ?? DEFAULT_NEUTRAL_CHROMA);
  const ladder = options.ladder ?? DEFAULT_NEUTRAL_LADDER;

  const harmony = generateHarmony(
    { ...seed, l: BRAND_LIGHTNESS },
    rule,
    { gamut, chroma: options.chroma ?? 'proportional', spread: options.spread }
  );

  // Build the full candidate ladder in priority order, then take `count`. The
  // order is what degrades gracefully: a three-color palette keeps a ground,
  // text and a brand color, which is the smallest set that still makes an
  // interface rather than a mood board.
  const brands = brandCandidates(harmony, gamut);

  // Neutrals must never be more chromatic than the brand colors. Beyond
  // being obviously right -- the greys should not out-color the color --
  // this is load-bearing: the role model picks primary and accent by chroma,
  // so a tinted neutral that beats a desaturated brand color gets assigned
  // as the brand, and the interface ends up with a mid grey where its
  // surface should be. Seeds close to grey hit that immediately.
  const brandChroma = Math.min(...brands.map((color) => color.oklch.c));
  const safeNeutral = Math.min(neutralChroma, brandChroma * NEUTRAL_CHROMA_HEADROOM);

  const candidates: PaletteColor[] = [
    neutral(ladder.background, seed.h, safeNeutral, gamut),
    neutral(ladder.text, seed.h, safeNeutral * 0.5, gamut),
    brands[0] ?? null,
    neutral(ladder.surface, seed.h, safeNeutral, gamut),
    brands[1] ?? null,
    neutral(ladder.border, seed.h, safeNeutral * 1.6, gamut),
    brands[2] ?? null,
    brands[3] ?? null,
  ].filter((color): color is PaletteColor => color !== null);

  return { colors: dedupe(candidates).slice(0, count), harmony };
}

function clampCount(count: number): number {
  if (!Number.isFinite(count)) return DEFAULT_SIZE;
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(count)));
}

/**
 * The palette's brand colors: the harmony's hues, extended with tones of the
 * seed hue when the harmony supplies fewer than the ladder has slots for.
 */
function brandCandidates(harmony: Harmony, gamut: Gamut): PaletteColor[] {
  // Deduped, because a rule can return more entries than distinct colors:
  // rotating hue on a color with no chroma is a no-op, so a square harmony
  // from a grey seed is four identical greys. Counting entries rather than
  // colors would skip the tonal fill below and leave the palette short.
  const fromHarmony: PaletteColor[] = dedupe(
    harmony.colors.map((color) => ({
      oklch: color.oklch,
      hex: color.hex,
      origin: 'harmony' as const,
    }))
  );
  if (fromHarmony.length >= MAX_BRAND_SLOTS) return fromHarmony;

  const base = fromHarmony[0];
  if (base === undefined) return fromHarmony;

  const tones = TONAL_LIGHTNESSES.map((l) => {
    const chroma = Math.min(base.oklch.c, maxChroma(l, base.oklch.h, gamut));
    const candidate: Oklch = { l, c: chroma, h: base.oklch.h };
    const oklch = isInGamut(candidate, gamut) ? candidate : mapToGamut(candidate, gamut).oklch;
    return { oklch, hex: formatHex(oklch), origin: 'harmony' as const };
  });

  return dedupe([...fromHarmony, ...tones]).slice(0, MAX_BRAND_SLOTS);
}

function neutral(l: number, hue: number, chroma: number, gamut: Gamut): PaletteColor {
  // The ceiling matters even here: at very low and very high lightness the
  // gamut narrows to almost nothing, and asking for a tint the display cannot
  // show would get clipped into a different hue than the brand it is meant to
  // echo.
  const safeChroma = Math.min(chroma, maxChroma(l, hue, gamut));
  const candidate: Oklch = { l, c: safeChroma, h: hue };
  const oklch = isInGamut(candidate, gamut) ? candidate : mapToGamut(candidate, gamut).oklch;
  return { oklch, hex: formatHex(oklch), origin: 'neutral' };
}

/**
 * Two candidates can land on the same hex — a harmony hue whose gamut ceiling
 * collapses at this lightness, or a seed so dark that its neutrals converge.
 * A palette with a repeated color would then hand the role model two
 * identical entries and quietly lose a role.
 */
function dedupe(colors: readonly PaletteColor[]): PaletteColor[] {
  const seen = new Set<string>();
  const out: PaletteColor[] = [];
  for (const color of colors) {
    const key = color.hex.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(color);
  }
  return out;
}
