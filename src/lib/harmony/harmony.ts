/**
 * Palette generation — the primitive this product was missing.
 *
 * Until now the engine could deepen one colour into a scale
 * (`generateScale`) but had nothing that turned one colour into a *set*.
 * That is the loop everyone arrives wanting, and its absence is why a
 * collector called the Harmonic Dock never had any harmony in it.
 *
 * ## Why this is not the same feature Coolors and Adobe ship
 *
 * Classical harmony is defined by hue angles, which is trivial in any colour
 * space. The hard part is that a hue rotation only *looks* harmonious if the
 * colours it produces carry equal visual weight — and in HSL they do not. HSL
 * lightness is not perceptual: a yellow and a blue at the same HSL lightness
 * read as completely different brightnesses, so an HSL triad always needs
 * fixing by hand afterwards.
 *
 * OKLCH fixes the perception half for free. But it introduces a problem HSL
 * never has to face, because OKLCH can describe colours a screen cannot show.
 * The sRGB gamut is not a cylinder in OKLCH — the achievable chroma varies
 * enormously with hue. Measured on this engine at L=0.55 it ranges from 0.093
 * to 0.294, a **3.1x spread**; a triad rooted at a vivid violet (c=0.21) is
 * simply unreachable at both of its other hues.
 *
 * So "hold lightness and chroma constant while rotating hue" — the naive
 * reading of the OKLCH advantage — produces out-of-gamut colours, and clipping
 * them shifts lightness *and* hue, destroying exactly the evenness the harmony
 * was for. Everything below exists to get that right, and it is the part no
 * HSL tool can copy, because HSL has no notion of a per-hue ceiling at all.
 *
 * Pure: no DOM, no React. Callers pass parsed OKLCH and get OKLCH back.
 */

import {
  formatHex,
  isInGamut,
  mapToGamut,
  maxChroma,
  normalizeHue,
  type Gamut,
  type Oklch,
} from '@/lib/color-engine';

export type HarmonyRule =
  | 'monochromatic'
  | 'analogous'
  | 'complementary'
  | 'split-complementary'
  | 'triad'
  | 'tetrad'
  | 'square';

export const HARMONY_RULES: readonly HarmonyRule[] = [
  'monochromatic',
  'analogous',
  'complementary',
  'split-complementary',
  'triad',
  'tetrad',
  'square',
];

/**
 * How to reconcile the seed's saturation with a gamut that offers a different
 * ceiling at every hue. There is no single right answer, so the choice is the
 * caller's and each is honest about what it trades.
 *
 * - `equal` — every colour shares one lightness and one chroma, so they carry
 *   genuinely equal visual weight. Costs vividness: the shared chroma can be
 *   no higher than the weakest hue's ceiling.
 * - `proportional` — every colour sits at the same fraction of *its own*
 *   ceiling. Keeps vividness and stays even in a looser sense; the colours are
 *   equally saturated for what their hue can do.
 * - `preserve` — keep the seed's chroma and gamut-map whatever cannot reach
 *   it. Most vivid, least even; useful when the seed is a fixed brand colour.
 */
export type ChromaStrategy = 'equal' | 'proportional' | 'preserve';

export interface HarmonyOptions {
  readonly gamut?: Gamut;
  readonly chroma?: ChromaStrategy;
  /** Degrees either side of the seed, `analogous` only. */
  readonly spread?: number;
}

export interface HarmonyColor {
  readonly oklch: Oklch;
  readonly hex: string;
  /** Degrees clockwise from the seed hue — 0 for the seed itself. */
  readonly hueOffset: number;
}

export interface Harmony {
  readonly rule: HarmonyRule;
  readonly colors: readonly HarmonyColor[];
  /** The one chroma every colour shares under `equal`; null otherwise. */
  readonly sharedChroma: number | null;
  /**
   * Under `equal`, the hue whose gamut ceiling pulled the shared chroma below
   * what the seed asked for — null when the seed's own chroma was reachable
   * everywhere. Surfaced so the interface can explain a muted result instead
   * of leaving it looking like a bug.
   */
  readonly limitedByHue: number | null;
}

const DEFAULT_ANALOGOUS_SPREAD = 30;

/** Hue offsets from the seed, by rule. */
const OFFSETS: Readonly<Record<HarmonyRule, readonly number[]>> = {
  monochromatic: [0],
  analogous: [0], // spread applied in harmonyHues
  complementary: [0, 180],
  'split-complementary': [0, 150, 210],
  triad: [0, 120, 240],
  // The classical rectangle: two complementary pairs 60 degrees apart.
  tetrad: [0, 60, 180, 240],
  square: [0, 90, 180, 270],
};

/**
 * The hue angles a rule produces, in degrees, seed first.
 *
 * Separated from colour generation because the angles are the part a person
 * reasons about ("give me a split complement") and the part an interface draws
 * on a wheel, neither of which needs a gamut.
 */
export function harmonyHues(
  rule: HarmonyRule,
  seedHue: number,
  spread: number = DEFAULT_ANALOGOUS_SPREAD
): number[] {
  const base = normalizeHue(seedHue);
  if (rule === 'analogous') {
    return [base, normalizeHue(base - spread), normalizeHue(base + spread)];
  }
  return OFFSETS[rule].map((offset) => normalizeHue(base + offset));
}

export function generateHarmony(
  seed: Oklch,
  rule: HarmonyRule,
  options: HarmonyOptions = {}
): Harmony {
  const gamut = options.gamut ?? 'srgb';
  const strategy = options.chroma ?? 'equal';
  const spread = options.spread ?? DEFAULT_ANALOGOUS_SPREAD;

  const hues = harmonyHues(rule, seed.h, spread);
  const offsets = hues.map((hue) => normalizeHue(hue - normalizeHue(seed.h)));

  const { chromas, sharedChroma, limitedByHue } = resolveChromas(seed, hues, gamut, strategy);

  const colors = hues.map((hue, index) => {
    const candidate: Oklch = { l: seed.l, c: chromas[index]!, h: hue };
    // `equal` and `proportional` derive chroma from the ceiling and are in
    // gamut by construction; `preserve` deliberately is not, so it is mapped.
    // Mapping the others too costs one cheap check and means no strategy can
    // ever leak an unshowable colour if the ceiling maths is ever wrong.
    const safe = isInGamut(candidate, gamut) ? candidate : mapToGamut(candidate, gamut).oklch;
    return { oklch: safe, hex: formatHex(safe), hueOffset: offsets[index]! };
  });

  return { rule, colors, sharedChroma, limitedByHue };
}

interface ResolvedChromas {
  readonly chromas: readonly number[];
  readonly sharedChroma: number | null;
  readonly limitedByHue: number | null;
}

function resolveChromas(
  seed: Oklch,
  hues: readonly number[],
  gamut: Gamut,
  strategy: ChromaStrategy
): ResolvedChromas {
  if (strategy === 'preserve') {
    return { chromas: hues.map(() => seed.c), sharedChroma: null, limitedByHue: null };
  }

  const ceilings = hues.map((hue) => maxChroma(seed.l, hue, gamut));

  if (strategy === 'proportional') {
    const seedCeiling = maxChroma(seed.l, normalizeHue(seed.h), gamut);
    // A seed sitting at a lightness with no chroma available at all (pure
    // black, pure white) has no meaningful ratio; treat it as neutral.
    const ratio = seedCeiling > 0 ? Math.min(1, seed.c / seedCeiling) : 0;
    return {
      chromas: ceilings.map((ceiling) => ratio * ceiling),
      sharedChroma: null,
      limitedByHue: null,
    };
  }

  // `equal`: one chroma for every hue. It can be no larger than the weakest
  // ceiling, and no larger than what the seed actually asked for — a quiet
  // seed must not be inflated to the edge of the gamut just because it could.
  let weakestIndex = 0;
  for (let i = 1; i < ceilings.length; i++) {
    if (ceilings[i]! < ceilings[weakestIndex]!) weakestIndex = i;
  }
  const weakest = ceilings[weakestIndex]!;
  const shared = Math.min(seed.c, weakest);

  return {
    chromas: hues.map(() => shared),
    sharedChroma: shared,
    // Only a genuine gamut limit is reported. When the seed was the binding
    // constraint the palette is exactly as saturated as it was asked to be,
    // and there is nothing to explain.
    limitedByHue: weakest < seed.c ? hues[weakestIndex]! : null,
  };
}
