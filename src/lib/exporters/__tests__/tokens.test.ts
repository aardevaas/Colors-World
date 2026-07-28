import { describe, expect, test } from 'vitest';
import { generateScale } from '@/lib/color-engine';
import {
  sanitiseScaleName,
  tailwindStepLabels,
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

describe('tailwindStepLabels', () => {
  test('at the 10-step cap, returns the full canonical 50-900 run with no gaps', () => {
    expect(tailwindStepLabels(10)).toEqual([
      '50', '100', '200', '300', '400', '500', '600', '700', '800', '900',
    ]);
  });

  test('never includes 950 at 10 steps — that rung is unreachable at the cap', () => {
    expect(tailwindStepLabels(10)).not.toContain('950');
  });

  test('for other step counts, samples evenly across the full 11-rung ladder', () => {
    const three = tailwindStepLabels(3);
    expect(three).toHaveLength(3);
    expect(three[0]).toBe('50');
    expect(three[2]).toBe('950');
  });

  test('never produces duplicate labels for a realistic 2-10 step range', () => {
    for (let count = 2; count <= 10; count += 1) {
      const labels = tailwindStepLabels(count);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });
});

describe('toTailwindTheme', () => {
  test('emits a v4 @theme block with --color- prefixed, index-based tokens', () => {
    const theme = toTailwindTheme(scales);
    expect(theme.startsWith('@theme {')).toBe(true);
    // Token identity stays index-based — this is what version control,
    // merge, and share links compare on, and it must never be renamed to a
    // Tailwind-style suffix.
    expect(theme).toContain('--color-brand-blue-5:');
  });

  test('annotates each declaration with its Tailwind-conventional label', () => {
    const theme = toTailwindTheme(scales);
    expect(theme).toContain('--color-brand-blue-5:');
    expect(theme).toMatch(/--color-brand-blue-5:[^\n]*\/\* 500 \*\//);
  });

  test('notes that 950 is unreachable for a 10-step scale', () => {
    const theme = toTailwindTheme(scales);
    expect(theme).toMatch(/950.*unreachable|unreachable.*950/i);
  });

  test('omits the 950 gap note for a scale that is not exactly 10 steps', () => {
    const fiveStepScale = generateScale({
      name: 'five',
      steps: 5,
      anchors: [{ step: 2, color: '#3b82f6' }],
    });
    const theme = toTailwindTheme([fiveStepScale]);
    expect(theme).not.toMatch(/unreachable/i);
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
