import { describe, expect, test } from 'vitest';
import {
  apcaContrast,
  auditContrast,
  bestTextColor,
  contrastRatio,
  relativeLuminance,
} from '../contrast';
import { parseColor } from '../color';

const WHITE = parseColor('#ffffff');
const BLACK = parseColor('#000000');

describe('relativeLuminance', () => {
  test('anchors at the sRGB extremes', () => {
    expect(relativeLuminance(WHITE)).toBeCloseTo(1, 5);
    expect(relativeLuminance(BLACK)).toBeCloseTo(0, 5);
  });

  test('weights green most heavily, blue least', () => {
    const red = relativeLuminance(parseColor('#ff0000'));
    const green = relativeLuminance(parseColor('#00ff00'));
    const blue = relativeLuminance(parseColor('#0000ff'));

    expect(green).toBeGreaterThan(red);
    expect(red).toBeGreaterThan(blue);
  });
});

describe('contrastRatio (WCAG 2.x)', () => {
  test('black on white is the maximum 21:1', () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 4);
  });

  test('a color against itself is 1:1', () => {
    expect(contrastRatio(WHITE, WHITE)).toBeCloseTo(1, 10);
  });

  test('is order-independent', () => {
    const a = parseColor('#3b82f6');
    const b = parseColor('#fef3c7');
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
  });

  test('#767676 is the classic borderline AA grey on white', () => {
    // This value is the darkest grey that still clears 4.5:1 on white, and is
    // widely used as a reference check for contrast implementations.
    const ratio = contrastRatio(parseColor('#767676'), WHITE);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeLessThan(4.6);
  });
});

describe('apcaContrast', () => {
  test('matches the published reference value for black on white', () => {
    expect(apcaContrast(BLACK, WHITE)).toBeCloseTo(106.04, 1);
  });

  test('matches the published reference value for white on black', () => {
    expect(apcaContrast(WHITE, BLACK)).toBeCloseTo(-107.88, 1);
  });

  test('is polarity-dependent, unlike the WCAG ratio', () => {
    // The whole point of APCA: swapping foreground and background is a
    // different perceptual result, not a mirrored one.
    expect(Math.abs(apcaContrast(BLACK, WHITE))).not.toBeCloseTo(
      Math.abs(apcaContrast(WHITE, BLACK)),
      1
    );
  });

  test('returns zero for identical colors', () => {
    expect(apcaContrast(WHITE, WHITE)).toBe(0);
  });
});

describe('auditContrast', () => {
  test('black on white passes every criterion', () => {
    const report = auditContrast(BLACK, WHITE);
    expect(report.normalText).toEqual({ aa: true, aaa: true });
    expect(report.largeText).toEqual({ aa: true, aaa: true });
    expect(report.nonText).toBe(true);
  });

  test('a low-contrast pairing fails normal text but may pass large text', () => {
    // ~3.1:1 — below the 4.5 normal-text bar, above the 3.0 large-text bar.
    const report = auditContrast(parseColor('#949494'), WHITE);
    expect(report.normalText.aa).toBe(false);
    expect(report.largeText.aa).toBe(true);
    expect(report.nonText).toBe(true);
  });

  test('near-identical colors fail everything', () => {
    const report = auditContrast(parseColor('#fefefe'), WHITE);
    expect(report.normalText.aa).toBe(false);
    expect(report.largeText.aa).toBe(false);
    expect(report.nonText).toBe(false);
  });
});

describe('bestTextColor', () => {
  test('picks black on a light background', () => {
    expect(bestTextColor(parseColor('#fef3c7'), [BLACK, WHITE])).toEqual(BLACK);
  });

  test('picks white on a dark background', () => {
    expect(bestTextColor(parseColor('#1e293b'), [BLACK, WHITE])).toEqual(WHITE);
  });

  test('requires at least one candidate', () => {
    expect(() => bestTextColor(WHITE, [])).toThrow(/at least one candidate/i);
  });
});
