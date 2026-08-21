import { describe, expect, test } from 'vitest';
import { CVD_TYPES, simulateCvd } from '../cvd';
import { parseColor, formatHex } from '../color';
import { contrastRatio } from '../contrast';

const RED = parseColor('#e5484d');
const GREEN = parseColor('#30a46c');

describe('simulateCvd', () => {
  test('leaves greys essentially untouched for every deficiency', () => {
    const grey = parseColor('#808080');
    for (const type of CVD_TYPES) {
      const simulated = simulateCvd(grey, type);
      expect(simulated.c).toBeLessThan(0.02);
      expect(simulated.l).toBeCloseTo(grey.l, 1);
    }
  });

  test('collapses red and green toward each other for deuteranopia', () => {
    const before = contrastRatio(RED, GREEN);
    const after = contrastRatio(
      simulateCvd(RED, 'deuteranopia'),
      simulateCvd(GREEN, 'deuteranopia')
    );
    // The classic red/green confusion: they become far harder to tell apart.
    expect(after).toBeLessThan(before);
  });

  test('protanopia darkens reds noticeably', () => {
    // Protanopes lack long-wavelength cones, so red loses apparent luminance.
    expect(simulateCvd(RED, 'protanopia').l).toBeLessThan(RED.l);
  });

  test('achromatopsia removes all chroma', () => {
    for (const color of [RED, GREEN, parseColor('#3b82f6')]) {
      expect(simulateCvd(color, 'achromatopsia').c).toBeLessThan(1e-6);
    }
  });

  test('preserves pure black and pure white', () => {
    for (const type of CVD_TYPES) {
      expect(formatHex(simulateCvd(parseColor('#000000'), type))).toBe('#000000');
      expect(formatHex(simulateCvd(parseColor('#ffffff'), type))).toBe('#ffffff');
    }
  });

  test('always returns a displayable sRGB color', () => {
    for (const type of CVD_TYPES) {
      const hex = formatHex(simulateCvd(parseColor('#e5484d'), type));
      expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
