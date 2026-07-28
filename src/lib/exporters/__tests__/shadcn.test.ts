import { describe, expect, test } from 'vitest';
import { generateScale } from '@/lib/color-engine';
import { toShadcnTheme } from '../shadcn';

const BLUE = generateScale({ name: 'brand-blue', anchors: [{ step: 5, color: '#3b82f6' }] });
const GREEN = generateScale({ name: 'accent-green', anchors: [{ step: 5, color: '#22c55e' }] });
const PURPLE = generateScale({ name: 'third', anchors: [{ step: 5, color: '#8e4ec6' }] });
const RED = generateScale({ name: 'danger', anchors: [{ step: 5, color: '#ef4444' }] });

describe('toShadcnTheme — structure', () => {
  test('emits both a :root (light) and .dark block', () => {
    const { css } = toShadcnTheme([BLUE]);
    expect(css).toContain(':root {');
    expect(css).toContain('.dark {');
  });

  test('fills background/foreground/card/border regardless of which colours were collected', () => {
    const withBlue = toShadcnTheme([BLUE]);
    const withGreen = toShadcnTheme([GREEN]);
    // Neutral slots come from this project's own obsidian tokens, not from
    // whatever brand colour happens to be collected — so they must be
    // identical across totally different inputs.
    const extractBackground = (css: string) => css.match(/--background: ([^;]+);/)?.[1];
    expect(extractBackground(withBlue.css)).toBe(extractBackground(withGreen.css));
  });

  test('handles an empty scale list without throwing', () => {
    const { css, unfilled } = toShadcnTheme([]);
    expect(css).toContain(':root {');
    expect(css).toContain('.dark {');
    expect(unfilled.length).toBeGreaterThan(0);
  });
});

describe('toShadcnTheme — primary/secondary/accent from real scales', () => {
  test('a single scale fills only primary; secondary and accent are disclosed as unfilled', () => {
    const { css, unfilled } = toShadcnTheme([BLUE]);
    expect(css).toContain('--primary:');
    expect(css).not.toContain('--secondary:');
    expect(css).not.toContain('--accent:');
    expect(unfilled.some((r) => r.includes('--secondary'))).toBe(true);
    expect(unfilled.some((r) => r.includes('--accent'))).toBe(true);
  });

  test('two scales fill primary and secondary; accent stays unfilled', () => {
    const { css, unfilled } = toShadcnTheme([BLUE, GREEN]);
    expect(css).toContain('--primary:');
    expect(css).toContain('--secondary:');
    expect(css).not.toContain('--accent:');
    expect(unfilled.some((r) => r.includes('--accent'))).toBe(true);
    expect(unfilled.some((r) => r.includes('--secondary'))).toBe(false);
  });

  test('three or more scales fill primary, secondary, and accent', () => {
    const { css, unfilled } = toShadcnTheme([BLUE, GREEN, PURPLE]);
    expect(css).toContain('--primary:');
    expect(css).toContain('--secondary:');
    expect(css).toContain('--accent:');
    expect(unfilled.some((r) => r.includes('--secondary') || r.includes('--accent'))).toBe(false);
  });

  test('primaryIndex selects which scale is primary', () => {
    const asPrimary = toShadcnTheme([BLUE, GREEN], { primaryIndex: 1 }).css;
    const defaultPrimary = toShadcnTheme([BLUE, GREEN]).css;
    const extractPrimary = (css: string) => css.match(/--primary: ([^;]+);/)?.[1];
    expect(extractPrimary(asPrimary)).not.toBe(extractPrimary(defaultPrimary));
  });
});

describe('toShadcnTheme — destructive is never invented', () => {
  test('fills --destructive only when a collected colour is actually red/pink', () => {
    const withoutRed = toShadcnTheme([BLUE, GREEN]);
    expect(withoutRed.css).not.toContain('--destructive:');
    expect(withoutRed.unfilled.some((r) => r.includes('--destructive'))).toBe(true);

    const withRed = toShadcnTheme([BLUE, GREEN, RED]);
    expect(withRed.css).toContain('--destructive:');
    expect(withRed.unfilled.some((r) => r.includes('--destructive'))).toBe(false);
  });

  test('the unfilled disclosure explains why, not just that it is missing', () => {
    const { unfilled } = toShadcnTheme([BLUE]);
    const destructiveReason = unfilled.find((r) => r.includes('--destructive'));
    expect(destructiveReason).toBeDefined();
    expect(destructiveReason).toMatch(/red|pink|hue/i);
  });
});

describe('toShadcnTheme — chart tokens', () => {
  test('emits one --chart-N per scale, in order', () => {
    const { css } = toShadcnTheme([BLUE, GREEN, PURPLE]);
    expect(css).toContain('--chart-1:');
    expect(css).toContain('--chart-2:');
    expect(css).toContain('--chart-3:');
    expect(css).not.toContain('--chart-4:');
  });

  test('caps at 5 chart tokens even with more scales', () => {
    const many = Array.from({ length: 7 }, (_, i) =>
      generateScale({ name: `s${i}`, anchors: [{ step: 5, color: '#3b82f6' }] })
    );
    const { css } = toShadcnTheme(many);
    expect(css).toContain('--chart-5:');
    expect(css).not.toContain('--chart-6:');
  });
});

describe('toShadcnTheme — foreground pairing', () => {
  test('every filled colour role has a corresponding -foreground pair', () => {
    const { css } = toShadcnTheme([BLUE, GREEN, PURPLE, RED]);
    for (const role of ['primary', 'secondary', 'accent', 'destructive']) {
      expect(css).toContain(`--${role}:`);
      expect(css).toContain(`--${role}-foreground:`);
    }
  });
});
