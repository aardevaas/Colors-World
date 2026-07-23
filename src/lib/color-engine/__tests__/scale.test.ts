import { describe, expect, test } from 'vitest';
import { generateScale } from '../scale';
import { isInGamut, maxChroma } from '../gamut';
import { parseColor } from '../color';

const BRAND_BLUE = '#3b82f6';

describe('maxChroma', () => {
  test('reports far more headroom at mid lightness than near white', () => {
    expect(maxChroma(0.62, 260, 'srgb')).toBeGreaterThan(maxChroma(0.97, 260, 'srgb'));
  });

  test('is hue-dependent — yellow outreaches blue near white', () => {
    // This asymmetry is precisely why a single analytic falloff curve cannot
    // shape chroma correctly for every hue.
    expect(maxChroma(0.95, 100, 'srgb')).toBeGreaterThan(maxChroma(0.95, 260, 'srgb'));
  });

  test('wider gamuts report more headroom', () => {
    expect(maxChroma(0.62, 145, 'p3')).toBeGreaterThan(maxChroma(0.62, 145, 'srgb'));
  });
});

describe('generateScale — anchor fidelity', () => {
  test('a pinned step resolves to exactly the pinned colour', () => {
    const scale = generateScale({
      name: 'blue',
      anchors: [{ step: 5, color: BRAND_BLUE }],
    });

    expect(scale.steps[5]!.hex).toBe(BRAND_BLUE);
    expect(scale.steps[5]!.isAnchor).toBe(true);
  });

  test('every pinned step in a multi-anchor scale is exact', () => {
    const scale = generateScale({
      name: 'dual',
      anchors: [
        { step: 2, color: '#c7d7fd' },
        { step: 7, color: '#1e40af' },
      ],
    });

    expect(scale.steps[2]!.hex).toBe('#c7d7fd');
    expect(scale.steps[7]!.hex).toBe('#1e40af');
    expect(scale.steps.filter((step) => step.isAnchor)).toHaveLength(2);
  });

  test('an anchor at an endpoint is honoured', () => {
    const scale = generateScale({
      name: 'edge',
      anchors: [{ step: 0, color: '#f8fafc' }],
    });
    expect(scale.steps[0]!.hex).toBe('#f8fafc');
  });
});

describe('generateScale — structural guarantees', () => {
  test('produces the requested number of steps, indexed from zero', () => {
    const scale = generateScale({
      name: 'blue',
      anchors: [{ step: 5, color: BRAND_BLUE }],
    });
    expect(scale.steps).toHaveLength(10);
    expect(scale.steps.map((s) => s.step)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test('honours a custom step count', () => {
    const scale = generateScale({
      name: 'blue',
      steps: 14,
      anchors: [{ step: 7, color: BRAND_BLUE }],
    });
    expect(scale.steps).toHaveLength(14);
  });

  test('lightness decreases strictly from step 0 to the last step', () => {
    const scale = generateScale({
      name: 'blue',
      anchors: [{ step: 5, color: BRAND_BLUE }],
    });

    for (let i = 1; i < scale.steps.length; i += 1) {
      expect(scale.steps[i]!.oklch.l).toBeLessThan(scale.steps[i - 1]!.oklch.l);
    }
  });

  test('every generated step is inside the requested gamut', () => {
    const scale = generateScale({
      name: 'vivid',
      anchors: [{ step: 5, color: 'oklch(60% 0.31 145)' }],
      gamut: 'srgb',
    });

    for (const step of scale.steps) {
      if (step.isAnchor) continue;
      expect(isInGamut(step.oklch, 'srgb')).toBe(true);
    }
  });

  test('P3 target admits chroma that sRGB cannot hold', () => {
    const spec = {
      name: 'green',
      anchors: [{ step: 5, color: 'oklch(60% 0.20 145)' }],
    } as const;

    const srgbScale = generateScale({ ...spec, gamut: 'srgb' });
    const p3Scale = generateScale({ ...spec, gamut: 'p3' });

    const srgbChroma = srgbScale.steps[3]!.oklch.c;
    const p3Chroma = p3Scale.steps[3]!.oklch.c;
    expect(p3Chroma).toBeGreaterThanOrEqual(srgbChroma);
  });

  test('an ordinary in-gamut anchor produces no clamped steps at all', () => {
    // The clamp flag is only useful if it stays quiet in the normal case. A
    // saturation-relative chroma model never over-asks, so nothing should fire.
    for (const color of ['#3b82f6', '#e5484d', '#f5d90a', '#30a46c', '#8e4ec6']) {
      const scale = generateScale({ name: 'ordinary', anchors: [{ step: 5, color }] });
      expect(scale.steps.filter((step) => step.gamutClamped)).toHaveLength(0);
    }
  });

  test('flags steps where the requested saturation exceeds the gamut', () => {
    const scale = generateScale({
      name: 'impossible',
      anchors: [{ step: 5, color: 'oklch(60% 0.4 145)' }],
      gamut: 'srgb',
    });
    expect(scale.steps.some((step) => step.gamutClamped)).toBe(true);
  });

  test('pushing chroma intensity past the ceiling raises the flag', () => {
    const scale = generateScale({
      name: 'overdriven',
      anchors: [{ step: 5, color: BRAND_BLUE }],
      chromaIntensity: 3,
    });
    expect(scale.steps.some((step) => step.gamutClamped)).toBe(true);
  });

  test('emits both hex and wide-gamut-safe CSS for each step', () => {
    const scale = generateScale({
      name: 'blue',
      anchors: [{ step: 5, color: BRAND_BLUE }],
    });

    for (const step of scale.steps) {
      expect(step.hex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(step.css).toMatch(/^oklch\(/);
    }
  });
});

describe('generateScale — hue behaviour', () => {
  test('holds hue constant when no torsion is requested', () => {
    const anchorHue = parseColor(BRAND_BLUE).h;
    const scale = generateScale({
      name: 'blue',
      anchors: [{ step: 5, color: BRAND_BLUE }],
      hueTorsion: 0,
    });

    for (const step of scale.steps) {
      if (step.gamutClamped || step.oklch.c < 0.01) continue;
      expect(Math.abs(step.oklch.h - anchorHue)).toBeLessThan(1);
    }
  });

  test('torsion rotates the ends without moving the anchor', () => {
    const scale = generateScale({
      name: 'warm-shadow',
      anchors: [{ step: 5, color: BRAND_BLUE }],
      hueTorsion: 30,
    });

    const anchorHue = parseColor(BRAND_BLUE).h;
    expect(scale.steps[5]!.oklch.h).toBeCloseTo(anchorHue, 6);
    expect(scale.steps[9]!.oklch.h).toBeGreaterThan(scale.steps[0]!.oklch.h);
  });
});

describe('generateScale — input validation', () => {
  test('rejects a scale with no anchors', () => {
    expect(() => generateScale({ name: 'empty', anchors: [] })).toThrow(
      /at least one anchor/i
    );
  });

  test('rejects an anchor outside the step range', () => {
    expect(() =>
      generateScale({ name: 'bad', anchors: [{ step: 12, color: BRAND_BLUE }] })
    ).toThrow(/outside the scale range/i);
  });

  test('rejects duplicate anchors on the same step', () => {
    expect(() =>
      generateScale({
        name: 'dupe',
        anchors: [
          { step: 3, color: BRAND_BLUE },
          { step: 3, color: '#ff0000' },
        ],
      })
    ).toThrow(/duplicate anchor/i);
  });

  test('rejects anchors that get lighter as the step increases', () => {
    expect(() =>
      generateScale({
        name: 'inverted',
        anchors: [
          { step: 2, color: '#1e40af' },
          { step: 7, color: '#c7d7fd' },
        ],
      })
    ).toThrow(/darker as step increases/i);
  });

  test('rejects an unparseable anchor colour', () => {
    expect(() =>
      generateScale({ name: 'bad', anchors: [{ step: 5, color: 'chartreusey' }] })
    ).toThrow(/unparseable/i);
  });

  test('rejects a degenerate step count', () => {
    expect(() =>
      generateScale({ name: 'tiny', steps: 1, anchors: [{ step: 0, color: BRAND_BLUE }] })
    ).toThrow(/at least 2 steps/i);
  });
});

describe('generateScale — determinism', () => {
  test('the same spec always produces the same scale', () => {
    const spec = {
      name: 'blue',
      anchors: [{ step: 5, color: BRAND_BLUE }],
      hueTorsion: 12,
      chromaIntensity: 0.9,
    } as const;

    expect(generateScale(spec).steps.map((s) => s.hex)).toEqual(
      generateScale(spec).steps.map((s) => s.hex)
    );
  });
});
