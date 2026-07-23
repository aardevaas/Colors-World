import { describe, expect, test } from 'vitest';
import { hueFamilyName } from '../hue-family';

describe('hueFamilyName', () => {
  test('names a vivid blue hue "blues"', () => {
    expect(hueFamilyName(240)).toBe('blues');
  });

  test('names a low red hue "reds"', () => {
    expect(hueFamilyName(5)).toBe('reds');
  });

  test('wraps hues at or above 360 back into range', () => {
    expect(hueFamilyName(365)).toBe(hueFamilyName(5));
  });

  test('handles negative hues by wrapping into [0, 360)', () => {
    expect(hueFamilyName(-10)).toBe(hueFamilyName(350));
  });

  test('every boundary between families is covered exactly once', () => {
    for (let hue = 0; hue < 360; hue += 1) {
      expect(() => hueFamilyName(hue)).not.toThrow();
    }
  });
});
