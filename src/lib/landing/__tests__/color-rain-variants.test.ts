import { describe, expect, test } from 'vitest';
import { buildRainBlockSeeds } from '../color-rain-variants';

describe('buildRainBlockSeeds', () => {
  const hueSteps = [0, 32, 64, 96, 128, 160, 192, 224];

  test('returns an empty list for no source hues', () => {
    expect(buildRainBlockSeeds([])).toEqual([]);
  });

  test('produces exactly 12 shade variants per source hue', () => {
    const seeds = buildRainBlockSeeds(hueSteps);
    expect(seeds.length).toBe(hueSteps.length * 12);
  });

  test('is interleaved round-robin — the first N seeds cover every hue once, in order', () => {
    const seeds = buildRainBlockSeeds(hueSteps);
    const firstRound = seeds.slice(0, hueSteps.length);
    expect(firstRound.map((seed) => seed.sourceHueIndex)).toEqual(
      hueSteps.map((_, index) => index)
    );
    expect(firstRound.every((seed) => seed.shadeIndex === 0)).toBe(true);
  });

  test('every seed carries a valid, real swatch computed from the colour engine', () => {
    const seeds = buildRainBlockSeeds(hueSteps);
    for (const seed of seeds) {
      expect(seed.swatch.hex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(seed.totalHues).toBe(hueSteps.length);
      expect(seed.sourceHueIndex).toBeGreaterThanOrEqual(0);
      expect(seed.sourceHueIndex).toBeLessThan(hueSteps.length);
      expect(seed.shadeIndex).toBeGreaterThanOrEqual(0);
      expect(seed.shadeIndex).toBeLessThan(12);
    }
  });

  test('shade variants for the same hue span meaningfully different lightness', () => {
    const seeds = buildRainBlockSeeds(hueSteps);
    const hueZeroSeeds = seeds.filter((seed) => seed.sourceHueIndex === 0);
    const lightnesses = hueZeroSeeds.map((seed) => seed.swatch.oklch.l);
    expect(Math.max(...lightnesses) - Math.min(...lightnesses)).toBeGreaterThan(0.3);
  });
});
