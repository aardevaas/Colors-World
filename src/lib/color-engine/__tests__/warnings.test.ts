import { describe, expect, test } from 'vitest';
import { auditGamutWarning } from '../warnings';

describe('auditGamutWarning', () => {
  test('an in-gamut colour reports no clamp and zero distance', () => {
    const softBlue = { l: 0.6, c: 0.05, h: 260 };
    const warning = auditGamutWarning(softBlue, 'srgb');
    expect(warning.clamped).toBe(false);
    expect(warning.mapped).toEqual(softBlue);
    expect(warning.deltaEOk).toBe(0);
  });

  test('a vivid out-of-sRGB-gamut colour reports the clamp and a positive distance', () => {
    const vivid = { l: 0.6, c: 0.35, h: 260 };
    const warning = auditGamutWarning(vivid, 'srgb');
    expect(warning.clamped).toBe(true);
    expect(warning.mapped.c).toBeLessThan(vivid.c);
    expect(warning.deltaEOk).toBeGreaterThan(0);
  });

  test('the same colour clamps harder against print than against sRGB', () => {
    const vividBlue = { l: 0.6, c: 0.2, h: 260 };
    const srgbWarning = auditGamutWarning(vividBlue, 'srgb');
    const printWarning = auditGamutWarning(vividBlue, 'print');

    expect(printWarning.clamped).toBe(true);
    expect(printWarning.mapped.c).toBeLessThanOrEqual(srgbWarning.mapped.c);
    expect(printWarning.deltaEOk).toBeGreaterThanOrEqual(srgbWarning.deltaEOk);
  });
});
