import { describe, expect, it } from 'vitest';
import { contrastRatio, isInGamut, parseColor, type Oklch } from '@/lib/color-engine';
import { SEMANTIC_ROLES, deriveRoles } from '@/lib/roles/semantic-roles';
import { HARMONY_RULES } from '../harmony';
import { PALETTE_SIZES, generatePalette } from '../palette';

const VIOLET: Oklch = parseColor('#7C5CFF');
const TAN: Oklch = parseColor('#CFA15D');
const GREEN: Oklch = parseColor('#19D368');

const SEEDS = [VIOLET, TAN, GREEN, parseColor('#FF0000'), parseColor('#0B0B0C')];

describe('generatePalette — shape', () => {
  it('returns exactly the number of colours asked for', () => {
    for (const size of PALETTE_SIZES) {
      expect(generatePalette(VIOLET, { count: size }).colors).toHaveLength(size);
    }
  });

  it('defaults to six, the size a UI actually needs', () => {
    expect(generatePalette(VIOLET).colors).toHaveLength(6);
  });

  it('never returns a duplicate colour', () => {
    for (const rule of HARMONY_RULES) {
      for (const size of PALETTE_SIZES) {
        for (const seed of SEEDS) {
          const hexes = generatePalette(seed, { rule, count: size }).colors.map((c) => c.hex);
          expect(new Set(hexes).size).toBe(hexes.length);
        }
      }
    }
  });

  it('stays inside the gamut', () => {
    for (const rule of HARMONY_RULES) {
      for (const seed of SEEDS) {
        for (const color of generatePalette(seed, { rule }).colors) {
          expect(isInGamut(color.oklch, 'srgb')).toBe(true);
        }
      }
    }
  });

  it('is deterministic', () => {
    expect(generatePalette(VIOLET, { rule: 'triad' })).toEqual(
      generatePalette(VIOLET, { rule: 'triad' })
    );
  });
});

describe('generatePalette — it has to feed the role model', () => {
  // The point of generating a palette rather than a harmony: a triad is three
  // vivid mid-tones, which makes a lovely swatch strip and an unusable
  // interface. What a UI needs is a ground to sit on, a panel above it, text
  // that reads, and a brand colour. These assert the generator produces
  // material the shared role model can actually assign.
  it('gives every role a distinct colour at every size', () => {
    for (const rule of HARMONY_RULES) {
      for (const size of PALETTE_SIZES) {
        for (const seed of SEEDS) {
          const palette = generatePalette(seed, { rule, count: size });
          const roles = deriveRoles(palette.colors.map((c) => ({ hex: c.hex, oklch: c.oklch })));
          const used = SEMANTIC_ROLES.map((r) => roles[r].hex.toLowerCase());
          expect(new Set(used).size).toBe(SEMANTIC_ROLES.length);
        }
      }
    }
  });

  it('produces text that actually reads on both background and surface', () => {
    // The failure this whole line of work started from was text on a card at
    // 1.19:1. A generated palette has no excuse for landing there.
    for (const rule of HARMONY_RULES) {
      for (const seed of SEEDS) {
        const palette = generatePalette(seed, { rule });
        const roles = deriveRoles(palette.colors.map((c) => ({ hex: c.hex, oklch: c.oklch })));
        expect(contrastRatio(roles.text.oklch, roles.background.oklch)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(roles.text.oklch, roles.surface.oklch)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('keeps the seed as the brand colour', () => {
    // Someone who seeds a palette from their brand violet expects to still
    // see their brand violet in it.
    const palette = generatePalette(VIOLET, { rule: 'triad', chroma: 'proportional' });
    const roles = deriveRoles(palette.colors.map((c) => ({ hex: c.hex, oklch: c.oklch })));
    expect(roles.primary.oklch.h).toBeCloseTo(VIOLET.h, 0);
  });

  it('spans enough lightness for a ground and a foreground', () => {
    for (const seed of SEEDS) {
      const ls = generatePalette(seed).colors.map((c) => c.oklch.l);
      expect(Math.max(...ls) - Math.min(...ls)).toBeGreaterThan(0.6);
    }
  });
});

describe('generatePalette — the neutrals', () => {
  it('tints the neutrals with the seed hue rather than using dead grey', () => {
    // A palette whose greys are literally grey looks like a template. Carrying
    // a trace of the brand hue through the neutrals is what makes a system
    // read as designed.
    const palette = generatePalette(VIOLET);
    const neutrals = palette.colors.filter((c) => c.oklch.c > 0 && c.oklch.c < 0.05);
    expect(neutrals.length).toBeGreaterThan(0);
    for (const neutral of neutrals) {
      expect(Math.abs(neutral.oklch.h - VIOLET.h)).toBeLessThan(1);
    }
  });

  it('can be told to use true neutrals instead', () => {
    const palette = generatePalette(VIOLET, { neutralChroma: 0 });
    const neutrals = palette.colors.filter((c) => c.oklch.c < 0.05);
    for (const neutral of neutrals) expect(neutral.oklch.c).toBe(0);
  });
});

describe('generatePalette — degenerate seeds', () => {
  it('survives pure black, pure white and pure grey', () => {
    for (const seed of [parseColor('#000000'), parseColor('#FFFFFF'), { l: 0.5, c: 0, h: 0 }]) {
      for (const rule of HARMONY_RULES) {
        const palette = generatePalette(seed, { rule });
        expect(palette.colors).toHaveLength(6);
        const hexes = palette.colors.map((c) => c.hex);
        expect(new Set(hexes).size).toBe(hexes.length);
      }
    }
  });

  it('clamps a count outside the supported range instead of returning nonsense', () => {
    expect(generatePalette(VIOLET, { count: 0 }).colors.length).toBeGreaterThanOrEqual(3);
    expect(generatePalette(VIOLET, { count: 99 }).colors.length).toBeLessThanOrEqual(8);
  });
});

describe('generatePalette — what it reports', () => {
  it('carries the harmony it was built from, so the interface can explain itself', () => {
    const palette = generatePalette(VIOLET, { rule: 'split-complementary' });
    expect(palette.harmony.rule).toBe('split-complementary');
    expect(palette.harmony.colors.length).toBeGreaterThan(1);
  });

  it('marks which colours came from the harmony and which are neutrals', () => {
    const palette = generatePalette(VIOLET);
    expect(palette.colors.some((c) => c.origin === 'harmony')).toBe(true);
    expect(palette.colors.some((c) => c.origin === 'neutral')).toBe(true);
  });
});
