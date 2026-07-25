import { describe, expect, it } from 'vitest';
import { decomposeIndex } from '../generate-color';
import { FAMILY_STEPS, familyRamp, familyStepSwatch } from '../swatch-family';

const SAMPLE_INDEX = 40_000_000 % (256 ** 3);

describe('familyStepSwatch', () => {
  it('holds hue and chroma fixed while walking the lightness axis', () => {
    const a = familyStepSwatch(SAMPLE_INDEX, 'lightness', 2);
    const b = familyStepSwatch(SAMPLE_INDEX, 'lightness', 9);
    const coordsA = decomposeIndex(a.index);
    const coordsB = decomposeIndex(b.index);
    expect(coordsA.hueStep).toBe(coordsB.hueStep);
    expect(coordsA.chromaStep).toBe(coordsB.chromaStep);
    expect(coordsA.lightnessStep).not.toBe(coordsB.lightnessStep);
  });

  it('holds hue and lightness fixed while walking the chroma axis', () => {
    const a = familyStepSwatch(SAMPLE_INDEX, 'chroma', 1);
    const b = familyStepSwatch(SAMPLE_INDEX, 'chroma', 10);
    const coordsA = decomposeIndex(a.index);
    const coordsB = decomposeIndex(b.index);
    expect(coordsA.hueStep).toBe(coordsB.hueStep);
    expect(coordsA.lightnessStep).toBe(coordsB.lightnessStep);
    expect(coordsA.chromaStep).not.toBe(coordsB.chromaStep);
  });

  it('holds lightness and chroma fixed while walking the hue-torsion axis', () => {
    const a = familyStepSwatch(SAMPLE_INDEX, 'hue', 3);
    const b = familyStepSwatch(SAMPLE_INDEX, 'hue', 8);
    const coordsA = decomposeIndex(a.index);
    const coordsB = decomposeIndex(b.index);
    expect(coordsA.lightnessStep).toBe(coordsB.lightnessStep);
    expect(coordsA.chromaStep).toBe(coordsB.chromaStep);
    expect(coordsA.hueStep).not.toBe(coordsB.hueStep);
  });

  it('step 1 and step 10 land at the axis extremes', () => {
    const lightest = familyStepSwatch(SAMPLE_INDEX, 'lightness', 1);
    const darkest = familyStepSwatch(SAMPLE_INDEX, 'lightness', 10);
    expect(decomposeIndex(lightest.index).lightnessStep).toBe(0);
    expect(decomposeIndex(darkest.index).lightnessStep).toBe(255);
  });

  it('clamps out-of-range step numbers instead of producing an invalid index', () => {
    const belowRange = familyStepSwatch(SAMPLE_INDEX, 'lightness', 0);
    const aboveRange = familyStepSwatch(SAMPLE_INDEX, 'lightness', 99);
    expect(belowRange).toEqual(familyStepSwatch(SAMPLE_INDEX, 'lightness', 1));
    expect(aboveRange).toEqual(familyStepSwatch(SAMPLE_INDEX, 'lightness', 10));
  });
});

describe('familyRamp', () => {
  it('returns exactly FAMILY_STEPS swatches', () => {
    expect(familyRamp(SAMPLE_INDEX, 'chroma')).toHaveLength(FAMILY_STEPS);
  });

  it('matches familyStepSwatch for each corresponding step', () => {
    const ramp = familyRamp(SAMPLE_INDEX, 'lightness');
    ramp.forEach((swatch, i) => {
      expect(swatch).toEqual(familyStepSwatch(SAMPLE_INDEX, 'lightness', i + 1));
    });
  });
});
