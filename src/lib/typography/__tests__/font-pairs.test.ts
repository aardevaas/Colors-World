import { describe, expect, test } from 'vitest';
import {
  DEFAULT_FONT_PAIR_ID,
  FONT_PAIRS,
  findFontPair,
  fontPairStylesheetUrl,
} from '../font-pairs';

describe('findFontPair', () => {
  test('finds a pair by id', () => {
    const pair = findFontPair('space-grotesk-inter');
    expect(pair.headingFamily).toBe('Space Grotesk');
    expect(pair.bodyFamily).toBe('Inter');
  });

  test('falls back to the first pair for an unknown id', () => {
    expect(findFontPair('does-not-exist')).toEqual(FONT_PAIRS[0]);
  });

  test('the default id resolves to a real pair', () => {
    expect(findFontPair(DEFAULT_FONT_PAIR_ID)).toBeDefined();
  });

  test('every pair has a unique id', () => {
    const ids = FONT_PAIRS.map((pair) => pair.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('fontPairStylesheetUrl', () => {
  test('builds a css2 URL requesting both families', () => {
    const url = fontPairStylesheetUrl(findFontPair('playfair-source-sans'));
    expect(url).toContain('https://fonts.googleapis.com/css2?');
    expect(url).toContain('family=Playfair%20Display:wght@700');
    expect(url).toContain('family=Source%20Sans%203:wght@400');
    expect(url).toContain('display=swap');
  });
});
