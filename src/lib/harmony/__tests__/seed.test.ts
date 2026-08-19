import { describe, expect, it } from 'vitest';
import { isInGamut, maxChroma } from '@/lib/color-engine';
import { SEED_LIGHTNESS, SEED_SATURATION, nextSeedAwayFrom, randomSeed } from '../seed';

/** A deterministic stand-in for Math.random, cycling a fixed sequence. */
function sequence(values: readonly number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

/** Mulberry32 — a small seeded PRNG, so "many rolls" is reproducible. */
function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('randomSeed', () => {
  it('is deterministic for a given random source', () => {
    expect(randomSeed(sequence([0.2, 0.4, 0.6]))).toEqual(randomSeed(sequence([0.2, 0.4, 0.6])));
  });

  it('always lands inside the gamut', () => {
    const random = seededRandom(1);
    for (let i = 0; i < 500; i++) {
      expect(isInGamut(randomSeed(random), 'srgb')).toBe(true);
    }
  });

  it('stays in the lightness band a brand colour can live in', () => {
    const random = seededRandom(2);
    for (let i = 0; i < 500; i++) {
      const seed = randomSeed(random);
      expect(seed.l).toBeGreaterThanOrEqual(SEED_LIGHTNESS.min);
      expect(seed.l).toBeLessThanOrEqual(SEED_LIGHTNESS.max);
    }
  });

  it('never rolls something indistinguishable from grey', () => {
    // The failure a uniform roll produces constantly, and the one that makes
    // a generator feel broken: press the button, get another grey.
    const random = seededRandom(3);
    for (let i = 0; i < 500; i++) {
      const seed = randomSeed(random);
      const ceiling = maxChroma(seed.l, seed.h, 'srgb');
      expect(seed.c / ceiling).toBeGreaterThanOrEqual(SEED_SATURATION.min - 1e-9);
    }
  });

  it('backs off the very edge of the gamut, where scales clip immediately', () => {
    const random = seededRandom(4);
    for (let i = 0; i < 500; i++) {
      const seed = randomSeed(random);
      expect(seed.c / maxChroma(seed.l, seed.h, 'srgb')).toBeLessThanOrEqual(
        SEED_SATURATION.max + 1e-9
      );
    }
  });

  it('reaches all the way round the wheel', () => {
    const random = seededRandom(5);
    const buckets = new Set<number>();
    for (let i = 0; i < 500; i++) buckets.add(Math.floor(randomSeed(random).h / 30));
    expect(buckets.size).toBe(12);
  });

  it('can be held to a hue family', () => {
    const random = seededRandom(6);
    for (let i = 0; i < 200; i++) {
      const seed = randomSeed(random, { hueRange: [280, 320] });
      expect(seed.h).toBeGreaterThanOrEqual(280);
      expect(seed.h).toBeLessThanOrEqual(320);
    }
  });

  it('survives a nonsensical hue range instead of returning NaN', () => {
    const seed = randomSeed(sequence([0.5]), { hueRange: [Number.NaN, 12] });
    expect(Number.isFinite(seed.h)).toBe(true);
    expect(Number.isFinite(seed.c)).toBe(true);
  });
});

describe('nextSeedAwayFrom', () => {
  it('always travels a meaningful distance from the hue in play', () => {
    // Two consecutive rolls landing a few degrees apart look like the button
    // did nothing, which is the single fastest way to lose trust in a
    // generator.
    const random = seededRandom(7);
    for (let i = 0; i < 500; i++) {
      const previous = random() * 360;
      const next = nextSeedAwayFrom(previous, random);
      // Shortest angular distance: 350 and 10 are 20 degrees apart, not 340.
      const travel = Math.abs(((next.h - previous + 540) % 360) - 180);
      expect(travel).toBeGreaterThanOrEqual(39);
    }
  });

  it('still returns a seed with all the properties of a fresh roll', () => {
    const random = seededRandom(8);
    for (let i = 0; i < 200; i++) {
      const seed = nextSeedAwayFrom(120, random);
      expect(isInGamut(seed, 'srgb')).toBe(true);
      expect(seed.l).toBeGreaterThanOrEqual(SEED_LIGHTNESS.min);
      expect(seed.l).toBeLessThanOrEqual(SEED_LIGHTNESS.max);
    }
  });

  it('wraps past 360 rather than running off the wheel', () => {
    const random = seededRandom(9);
    for (let i = 0; i < 200; i++) {
      const seed = nextSeedAwayFrom(350, random);
      expect(seed.h).toBeGreaterThanOrEqual(0);
      expect(seed.h).toBeLessThan(360);
    }
  });
});
