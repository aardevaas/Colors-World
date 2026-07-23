import { describe, expect, test } from 'vitest';
import { generateScale } from '@/lib/color-engine';
import {
  sanitiseScaleName,
  toCssCustomProperties,
  toFigmaTokens,
  toTailwindTheme,
} from '../tokens';

const scales = [
  generateScale({ name: 'Brand Blue', anchors: [{ step: 5, color: '#3b82f6' }] }),
  generateScale({ name: 'slate', anchors: [{ step: 5, color: '#64748b' }] }),
];

describe('sanitiseScaleName', () => {
  test('lowercases and hyphenates', () => {
    expect(sanitiseScaleName('Brand Blue')).toBe('brand-blue');
    expect(sanitiseScaleName('Warm/Grey 2')).toBe('warm-grey-2');
  });
});

describe('toCssCustomProperties', () => {
  test('emits one property per step under :root by default', () => {
    const css = toCssCustomProperties(scales);
    expect(css.startsWith(':root {')).toBe(true);
    expect(css).toContain('--brand-blue-5:');
    expect(css).toContain('--slate-0:');
    expect(css.match(/--/g)).toHaveLength(20);
  });

  test('honours a custom selector', () => {
    expect(toCssCustomProperties(scales, { selector: '[data-theme="dark"]' })).toContain(
      '[data-theme="dark"] {'
    );
  });

  test('exports oklch rather than hex to preserve wide gamut', () => {
    expect(toCssCustomProperties(scales)).toContain('oklch(');
  });
});

describe('toTailwindTheme', () => {
  test('emits a v4 @theme block with --color- prefixed tokens', () => {
    const theme = toTailwindTheme(scales);
    expect(theme.startsWith('@theme {')).toBe(true);
    expect(theme).toContain('--color-brand-blue-5:');
  });
});

describe('toFigmaTokens', () => {
  test('produces valid W3C design-token JSON', () => {
    const parsed = JSON.parse(toFigmaTokens(scales));
    expect(Object.keys(parsed)).toEqual(['brand-blue', 'slate']);
    expect(parsed['brand-blue']['5']).toEqual({ $type: 'color', $value: '#3b82f6' });
  });

  test('uses hex, because Figma importers cannot parse oklch', () => {
    expect(toFigmaTokens(scales)).not.toContain('oklch');
  });
});

describe('all exporters', () => {
  test('handle an empty scale list without emitting malformed output', () => {
    expect(toCssCustomProperties([])).toContain(':root {');
    expect(toTailwindTheme([])).toContain('@theme {');
    expect(JSON.parse(toFigmaTokens([]))).toEqual({});
  });
});
