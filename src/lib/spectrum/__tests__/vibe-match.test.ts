import { describe, expect, it } from 'vitest';
import { shortestHueDelta } from '@/lib/color-engine';
import type { VibeSearchTarget } from '../vibe-search';
import { findVibeMatches } from '../vibe-match';

const OCEAN_TARGET: VibeSearchTarget = {
  seed: { l: 0.45, c: 0.1, h: 210 },
  lightnessRange: [0.3, 0.6],
  chromaRange: [0.04, 0.16],
  hueSpread: 30,
  source: 'offline-fallback',
  rationale: 'test fixture',
};

const NARROW_TARGET: VibeSearchTarget = {
  seed: { l: 0.5, c: 0.1, h: 40 },
  lightnessRange: [0.499, 0.501],
  chromaRange: [0.0999, 0.1001],
  hueSpread: 0.05,
  source: 'offline-fallback',
  rationale: 'test fixture — deliberately near-impossible to satisfy',
};

describe('findVibeMatches', () => {
  it('returns swatches that all satisfy the target region', () => {
    const matches = findVibeMatches(OCEAN_TARGET, 20, { sampleSeed: 1 });
    expect(matches.length).toBeGreaterThan(0);
    for (const swatch of matches) {
      const { oklch } = swatch;
      expect(oklch.l).toBeGreaterThanOrEqual(OCEAN_TARGET.lightnessRange[0]);
      expect(oklch.l).toBeLessThanOrEqual(OCEAN_TARGET.lightnessRange[1]);
      expect(oklch.c).toBeGreaterThanOrEqual(OCEAN_TARGET.chromaRange[0]);
      expect(oklch.c).toBeLessThanOrEqual(OCEAN_TARGET.chromaRange[1]);
      expect(Math.abs(shortestHueDelta(OCEAN_TARGET.seed.h, oklch.h))).toBeLessThanOrEqual(
        OCEAN_TARGET.hueSpread
      );
    }
  });

  it('never returns more than the requested count', () => {
    const matches = findVibeMatches(OCEAN_TARGET, 5, { sampleSeed: 2 });
    expect(matches.length).toBeLessThanOrEqual(5);
  });

  it('is deterministic for the same sampleSeed', () => {
    const first = findVibeMatches(OCEAN_TARGET, 15, { sampleSeed: 42 });
    const second = findVibeMatches(OCEAN_TARGET, 15, { sampleSeed: 42 });
    expect(first).toEqual(second);
  });

  it('samples a spread of distinct swatches rather than clustering on one point', () => {
    const matches = findVibeMatches(OCEAN_TARGET, 30, { sampleSeed: 3 });
    const distinctHexes = new Set(matches.map((s) => s.hex));
    // The regression this guards: an earlier point-radius implementation
    // returned a wall of near-duplicate hexes for exactly this kind of
    // target, because adjacent indices in generate-color.ts's index space
    // decode to near-identical rounded colors.
    expect(distinctHexes.size).toBeGreaterThan(matches.length * 0.5);
  });

  it('degrades to an empty (not crashing) result when the scan budget is too small for a near-impossible target', () => {
    const matches = findVibeMatches(NARROW_TARGET, 10, { sampleSeed: 4, scanBudget: 500 });
    expect(Array.isArray(matches)).toBe(true);
    expect(matches.length).toBeLessThanOrEqual(10);
  });

  it('draws a different sample for a different sampleSeed', () => {
    const a = findVibeMatches(OCEAN_TARGET, 20, { sampleSeed: 10 });
    const b = findVibeMatches(OCEAN_TARGET, 20, { sampleSeed: 11 });
    expect(a).not.toEqual(b);
  });
});
