import { describe, expect, it } from 'vitest';
import { oklchToBucketIndex } from '../bucket-index';
import { decomposeIndex, indexToOklch } from '../generate-color';

describe('oklchToBucketIndex', () => {
  it('round-trips a sample of generated swatches back to their own bucket', () => {
    // Spread across the space rather than testing every one of the 16.7M —
    // if the inverse formula is right at all, it's right everywhere; if it's
    // wrong, a spread sample finds that just as reliably as an exhaustive one.
    const sampleIndices = [
      0, 1, 255, 256, 65_535, 65_536, 100_000, 1_000_000, 8_000_000, 16_000_000,
      16_777_215,
    ];

    for (const index of sampleIndices) {
      const oklch = indexToOklch(index);
      const recovered = oklchToBucketIndex(oklch);
      expect(recovered).toBe(index);
    }
  });

  it('wraps hue correctly at the 0/360 seam', () => {
    const justBelow360 = oklchToBucketIndex({ l: 0.5, c: 0.05, h: 359.9 });
    const zero = oklchToBucketIndex({ l: 0.5, c: 0.05, h: 0 });
    const { hueStep: hueStepBelow } = decomposeIndex(justBelow360);
    const { hueStep: hueStepZero } = decomposeIndex(zero);
    // 359.9 should land in the last hue step (255), not wrap around to 0.
    expect(hueStepBelow).toBe(255);
    expect(hueStepZero).toBe(0);
  });

  it('handles negative hue input by normalizing before bucketing', () => {
    const negative = oklchToBucketIndex({ l: 0.5, c: 0.05, h: -10 });
    const equivalent = oklchToBucketIndex({ l: 0.5, c: 0.05, h: 350 });
    expect(negative).toBe(equivalent);
  });

  it('clamps chroma at or beyond the gamut ceiling to the top step, not out of range', () => {
    const overChroma = oklchToBucketIndex({ l: 0.5, c: 999, h: 120 });
    const { chromaStep } = decomposeIndex(overChroma);
    expect(chromaStep).toBe(255);
  });

  it('handles zero chroma (achromatic) without dividing by zero', () => {
    expect(() => oklchToBucketIndex({ l: 0.5, c: 0, h: 0 })).not.toThrow();
    const { chromaStep } = decomposeIndex(oklchToBucketIndex({ l: 0.5, c: 0, h: 0 }));
    expect(chromaStep).toBe(0);
  });

  it('produces an index within the valid 0..16,777,215 range for arbitrary input', () => {
    const index = oklchToBucketIndex({ l: 0.6, c: 0.12, h: 210 });
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(256 ** 3);
  });
});
