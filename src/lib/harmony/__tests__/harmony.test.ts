import { describe, expect, it } from 'vitest';
import { isInGamut, maxChroma, parseColor, type Oklch } from '@/lib/color-engine';
import { HARMONY_RULES, generateHarmony, harmonyHues } from '../harmony';

/** A vivid violet — the seed most likely to expose gamut trouble. */
const VIOLET: Oklch = parseColor('#7C5CFF');
/** A muted tan, to check nothing inflates a quiet seed. */
const TAN: Oklch = parseColor('#CFA15D');

describe('harmonyHues', () => {
  it('starts every harmony at the seed hue', () => {
    for (const rule of HARMONY_RULES) {
      expect(harmonyHues(rule, 285)[0]).toBe(285);
    }
  });

  it('places the classical relationships where theory says', () => {
    expect(harmonyHues('complementary', 0)).toEqual([0, 180]);
    expect(harmonyHues('triad', 0)).toEqual([0, 120, 240]);
    expect(harmonyHues('square', 0)).toEqual([0, 90, 180, 270]);
    expect(harmonyHues('split-complementary', 0)).toEqual([0, 150, 210]);
    expect(harmonyHues('tetrad', 0)).toEqual([0, 60, 180, 240]);
    expect(harmonyHues('monochromatic', 0)).toEqual([0]);
  });

  it('wraps past 360 rather than running off the end of the wheel', () => {
    expect(harmonyHues('triad', 300)).toEqual([300, 60, 180]);
    expect(harmonyHues('complementary', 200)).toEqual([200, 20]);
  });

  it('spreads analogous either side of the seed', () => {
    expect(harmonyHues('analogous', 100)).toEqual([100, 70, 130]);
    expect(harmonyHues('analogous', 100, 45)).toEqual([100, 55, 145]);
  });

  it('normalises a seed hue given outside 0-360', () => {
    expect(harmonyHues('complementary', 420)).toEqual([60, 240]);
    expect(harmonyHues('complementary', -30)).toEqual([330, 150]);
  });
});

describe('generateHarmony — gamut safety', () => {
  // The whole claim rests on this. Measured on this engine: at L=0.55 the
  // achievable chroma ranges from 0.093 to 0.294 across hue, a 3.1x spread.
  // A harmony that ignores that produces colours the display cannot show,
  // and clipping them shifts lightness and hue — destroying the evenness
  // the harmony existed to provide.
  it('never returns a colour outside the requested gamut', () => {
    for (const rule of HARMONY_RULES) {
      for (const strategy of ['equal', 'proportional', 'preserve'] as const) {
        for (const seed of [VIOLET, TAN, parseColor('#19D368'), parseColor('#FF0000')]) {
          const harmony = generateHarmony(seed, rule, { chroma: strategy });
          for (const color of harmony.colors) {
            expect(isInGamut(color.oklch, 'srgb')).toBe(true);
          }
        }
      }
    }
  });

  it('emits a hex for every colour', () => {
    for (const color of generateHarmony(VIOLET, 'triad').colors) {
      expect(color.hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('generateHarmony — equal weight', () => {
  it('gives every colour the same lightness and chroma', () => {
    const harmony = generateHarmony(VIOLET, 'triad', { chroma: 'equal' });
    const [first, ...rest] = harmony.colors;
    for (const color of rest) {
      expect(color.oklch.l).toBeCloseTo(first!.oklch.l, 10);
      expect(color.oklch.c).toBeCloseTo(first!.oklch.c, 10);
    }
  });

  it('reports the shared chroma and which hue forced it down', () => {
    const harmony = generateHarmony(VIOLET, 'triad', { chroma: 'equal' });
    expect(harmony.sharedChroma).not.toBeNull();
    // The seed's own chroma is unreachable at the other two hues, so the
    // harmony must say so rather than silently muting the palette.
    expect(harmony.sharedChroma!).toBeLessThan(VIOLET.c);
    expect(harmony.limitedByHue).not.toBeNull();
  });

  it('caps at the seed rather than inflating a muted colour to the ceiling', () => {
    const quiet: Oklch = { l: 0.6, c: 0.02, h: 285 };
    const harmony = generateHarmony(quiet, 'triad', { chroma: 'equal' });
    expect(harmony.sharedChroma!).toBeLessThanOrEqual(0.02 + 1e-9);
    expect(harmony.limitedByHue).toBeNull();
  });

  it('is exactly the seed chroma when every hue can reach it', () => {
    const harmony = generateHarmony({ l: 0.6, c: 0.03, h: 285 }, 'square', { chroma: 'equal' });
    expect(harmony.sharedChroma!).toBeCloseTo(0.03, 10);
  });

  it('keeps the seed hue exactly, so the brand colour survives', () => {
    const harmony = generateHarmony(VIOLET, 'triad', { chroma: 'equal' });
    expect(harmony.colors[0]!.oklch.h).toBeCloseTo(VIOLET.h, 10);
  });
});

describe('generateHarmony — proportional chroma', () => {
  it('keeps each colour equally saturated relative to its own ceiling', () => {
    // The other honest answer to an uneven gamut: rather than muting every
    // hue to the weakest, let each be as saturated as that hue can be, in
    // the same proportion. Impossible in HSL, which has no notion of a
    // per-hue ceiling at all.
    const harmony = generateHarmony(VIOLET, 'triad', { chroma: 'proportional' });
    const ratios = harmony.colors.map(
      (c) => c.oklch.c / maxChroma(c.oklch.l, c.oklch.h, 'srgb')
    );
    const [first, ...rest] = ratios;
    for (const ratio of rest) expect(ratio).toBeCloseTo(first!, 6);
  });

  it('leaves a fully-saturated seed fully saturated', () => {
    const onEdge: Oklch = { l: 0.55, c: maxChroma(0.55, 300, 'srgb'), h: 300 };
    const harmony = generateHarmony(onEdge, 'complementary', { chroma: 'proportional' });
    expect(harmony.colors[0]!.oklch.c).toBeCloseTo(onEdge.c, 6);
  });

  it('reports no shared chroma, because there is not one', () => {
    expect(generateHarmony(VIOLET, 'triad', { chroma: 'proportional' }).sharedChroma).toBeNull();
  });
});

describe('generateHarmony — determinism and shape', () => {
  it('returns one colour per hue in the rule', () => {
    expect(generateHarmony(VIOLET, 'monochromatic').colors).toHaveLength(1);
    expect(generateHarmony(VIOLET, 'complementary').colors).toHaveLength(2);
    expect(generateHarmony(VIOLET, 'triad').colors).toHaveLength(3);
    expect(generateHarmony(VIOLET, 'square').colors).toHaveLength(4);
    expect(generateHarmony(VIOLET, 'tetrad').colors).toHaveLength(4);
  });

  it('records each colour offset from the seed', () => {
    const offsets = generateHarmony(VIOLET, 'triad').colors.map((c) => c.hueOffset);
    expect(offsets).toEqual([0, 120, 240]);
  });

  it('is deterministic', () => {
    expect(generateHarmony(VIOLET, 'triad')).toEqual(generateHarmony(VIOLET, 'triad'));
  });

  it('never returns duplicate colours', () => {
    for (const rule of HARMONY_RULES) {
      const hexes = generateHarmony(VIOLET, rule).colors.map((c) => c.hex);
      expect(new Set(hexes).size).toBe(hexes.length);
    }
  });

  it('survives a greyscale seed, which has no meaningful hue', () => {
    const grey: Oklch = { l: 0.5, c: 0, h: 0 };
    for (const rule of HARMONY_RULES) {
      const harmony = generateHarmony(grey, rule);
      expect(harmony.colors.length).toBeGreaterThan(0);
      for (const color of harmony.colors) expect(isInGamut(color.oklch, 'srgb')).toBe(true);
    }
  });

  it('survives pure black and pure white', () => {
    for (const seed of [parseColor('#000000'), parseColor('#FFFFFF')]) {
      for (const rule of HARMONY_RULES) {
        expect(() => generateHarmony(seed, rule)).not.toThrow();
      }
    }
  });
});

describe('generateHarmony — the claim against HSL', () => {
  it('holds perceptual lightness constant where HSL would not', () => {
    // The concrete difference. Rotating hue in HSL at fixed S and L gives
    // colours of wildly different perceived lightness -- an HSL triad from
    // a mid blue lands a yellow that reads far brighter than its siblings.
    // Ordering by OKLCH lightness is only meaningful because it does not.
    const harmony = generateHarmony({ l: 0.55, c: 0.12, h: 250 }, 'triad', { chroma: 'equal' });
    const lightnesses = harmony.colors.map((c) => c.oklch.l);
    expect(Math.max(...lightnesses) - Math.min(...lightnesses)).toBeLessThan(1e-9);
  });
});
