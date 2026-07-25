import { describe, expect, it } from 'vitest';
import { randomSeed, shuffledIndex } from '../discovery-feed';

const SPECTRUM_SIZE = 256 ** 3;

describe('shuffledIndex', () => {
  it('stays within the valid 24-bit index range', () => {
    for (let position = 0; position < 2000; position += 1) {
      const index = shuffledIndex(position, 12345);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(SPECTRUM_SIZE);
    }
  });

  it('never repeats an index across a large run of positions (bijective)', () => {
    const seen = new Set<number>();
    for (let position = 0; position < 20000; position += 1) {
      const index = shuffledIndex(position, 999);
      expect(seen.has(index)).toBe(false);
      seen.add(index);
    }
  });

  it('produces a different sequence for a different seed', () => {
    const sequenceA = Array.from({ length: 50 }, (_, i) => shuffledIndex(i, 1));
    const sequenceB = Array.from({ length: 50 }, (_, i) => shuffledIndex(i, 2));
    expect(sequenceA).not.toEqual(sequenceB);
  });

  it('is deterministic for the same position and seed', () => {
    expect(shuffledIndex(500, 42)).toBe(shuffledIndex(500, 42));
  });

  it('does not trivially return the identity permutation', () => {
    const identityMatches = Array.from({ length: 100 }, (_, i) => i).filter(
      (i) => shuffledIndex(i, 7) === i
    );
    // A well-mixed permutation should not just echo the input back for a
    // large fraction of positions.
    expect(identityMatches.length).toBeLessThan(10);
  });

  it('covers the full space without repeats up to the maximum index (spot check)', () => {
    // Exhaustively verifying all 16,777,216 positions is unnecessary for a
    // unit test; a bijection proof follows from the Feistel construction
    // itself (see discovery-feed.ts's module comment). This spot-checks a
    // sample spread across the full range, including the boundary values.
    const boundaryPositions = [0, 1, SPECTRUM_SIZE - 1, SPECTRUM_SIZE >> 1, SPECTRUM_SIZE - 2];
    const seen = new Set<number>();
    for (const position of boundaryPositions) {
      const index = shuffledIndex(position, 55);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(SPECTRUM_SIZE);
      expect(seen.has(index)).toBe(false);
      seen.add(index);
    }
  });
});

describe('randomSeed', () => {
  it('returns a non-negative 32-bit unsigned integer', () => {
    const seed = randomSeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(0xffffffff);
  });

  it('varies across calls', () => {
    const seeds = new Set(Array.from({ length: 20 }, () => randomSeed()));
    expect(seeds.size).toBeGreaterThan(1);
  });
});
