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
