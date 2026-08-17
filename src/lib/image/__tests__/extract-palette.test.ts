import { describe, expect, test } from 'vitest';
import { extractDominantColors, rgbToHex, type RgbSample } from '../extract-palette';

function repeat(sample: RgbSample, count: number): RgbSample[] {
  return Array.from({ length: count }, () => sample);
}

describe('extractDominantColors', () => {
  test('recovers two well-separated clusters', () => {
    const pixels = [...repeat({ r: 250, g: 10, b: 10 }, 20), ...repeat({ r: 10, g: 10, b: 250 }, 20)];
    const colors = extractDominantColors(pixels, 2);

    expect(colors).toHaveLength(2);
    const isRed = (c: RgbSample) => c.r > 200 && c.b < 50;
    const isBlue = (c: RgbSample) => c.b > 200 && c.r < 50;
    expect(colors.some(isRed)).toBe(true);
    expect(colors.some(isBlue)).toBe(true);
  });

  test('orders results by cluster population, largest first', () => {
    const pixels = [
      ...repeat({ r: 250, g: 10, b: 10 }, 90),
      ...repeat({ r: 10, g: 10, b: 250 }, 10),
    ];
    const colors = extractDominantColors(pixels, 2);
    expect(colors[0]!.r).toBeGreaterThan(200);
    expect(colors[1]!.b).toBeGreaterThan(200);
  });

  test('is deterministic for the same input', () => {
    const pixels = [
      ...repeat({ r: 250, g: 10, b: 10 }, 15),
      ...repeat({ r: 10, g: 250, b: 10 }, 15),
      ...repeat({ r: 10, g: 10, b: 250 }, 15),
    ];
    expect(extractDominantColors(pixels, 3)).toEqual(extractDominantColors(pixels, 3));
  });

  test('caps cluster count at the number of available pixels', () => {
    const pixels = repeat({ r: 100, g: 100, b: 100 }, 2);
    expect(extractDominantColors(pixels, 5)).toHaveLength(2);
  });

  test('rejects an empty pixel sample', () => {
    expect(() => extractDominantColors([], 5)).toThrow();
  });
});

describe('rgbToHex', () => {
  test('formats and clamps channel values', () => {
    expect(rgbToHex({ r: 255, g: 0, b: 128 })).toBe('#ff0080');
    expect(rgbToHex({ r: 300, g: -10, b: 127.6 })).toBe('#ff0080');
  });
});

/**
 * Reimplementation of the module's PRE-OKLab algorithm — Lloyd's k-means
 * with the identical seeding/iteration structure, but clustering raw sRGB
 * distance instead of OKLab distance. Exists only in this test, as the
 * baseline the regression test below proves the real module now beats.
 */
function extractDominantColorsRgbSpace(pixels: readonly RgbSample[], clusterCount: number): RgbSample[] {
  const k = Math.min(clusterCount, pixels.length);
  const centroids: RgbSample[] = [];
  for (let i = 0; i < k; i += 1) {
    centroids.push({ ...pixels[Math.floor((i * pixels.length) / k)]! });
  }
  let assignments = new Array<number>(pixels.length).fill(0);
  for (let iteration = 0; iteration < 8; iteration += 1) {
    assignments = pixels.map((pixel) => {
      let bestIndex = 0;
      let bestDistance = Infinity;
      centroids.forEach((centroid, index) => {
        const distance = (pixel.r - centroid.r) ** 2 + (pixel.g - centroid.g) ** 2 + (pixel.b - centroid.b) ** 2;
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });
      return bestIndex;
    });
    const sums = Array.from({ length: k }, () => ({ r: 0, g: 0, b: 0, count: 0 }));
    pixels.forEach((pixel, index) => {
      const bucket = sums[assignments[index]!]!;
      bucket.r += pixel.r;
      bucket.g += pixel.g;
      bucket.b += pixel.b;
      bucket.count += 1;
    });
    for (let c = 0; c < k; c += 1) {
      const bucket = sums[c]!;
      if (bucket.count > 0) centroids[c] = { r: bucket.r / bucket.count, g: bucket.g / bucket.count, b: bucket.b / bucket.count };
    }
  }
  return centroids.map((c) => ({ r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b) }));
}

function rgbDistance(a: RgbSample, b: RgbSample): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

describe('extractDominantColors — OKLab clustering separates what sRGB distance wrongly merges', () => {
  // navy is closer to green than pink is *in raw sRGB distance* (232 vs 376),
  // but perceptually further from green than pink is (0.749 vs 0.555 in
  // OKLab) — a real crossover, not just a magnitude difference. With k=2,
  // sRGB-space k-means merges navy into the green cluster; OKLab-space
  // k-means keeps navy as its own distinct dominant colour instead.
  const navy: RgbSample = { r: 4, g: 7, b: 28 };
  const pink: RgbSample = { r: 244, g: 82, b: 251 };
  const green: RgbSample = { r: 6, g: 238, b: 5 };
  const pixels = [...repeat(navy, 30), ...repeat(pink, 30), ...repeat(green, 30)];

  test('sanity check: raw sRGB distance and OKLab distance disagree on which colour green is closer to', () => {
    // This is the premise the rest of the test relies on — confirmed via
    // the module's own OKLab-space clustering behaviour below, not
    // asserted directly here to avoid re-implementing colour conversion.
    expect(rgbDistance(green, navy)).toBeLessThan(rgbDistance(green, pink));
  });

  test('the real (OKLab-space) extraction keeps navy as its own distinct cluster', () => {
    const colors = extractDominantColors(pixels, 2);
    const closestToNavy = Math.min(...colors.map((c) => rgbDistance(c, navy)));
    expect(closestToNavy).toBeLessThan(15);
  });

  test('the old (sRGB-space) algorithm would have wrongly merged navy into the green cluster instead', () => {
    const colors = extractDominantColorsRgbSpace(pixels, 2);
    const closestToNavy = Math.min(...colors.map((c) => rgbDistance(c, navy)));
    // Neither resulting centroid is close to pure navy — it got blended
    // away into a navy/green mix, which is exactly the failure mode the
    // OKLab-space rewrite fixes.
    expect(closestToNavy).toBeGreaterThan(80);
  });
});
