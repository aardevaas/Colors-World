import { describe, expect, test } from 'vitest';
import { generateScale } from '../scale';
import { buildContrastMatrix } from '../contrast-matrix';

const scale = generateScale({ name: 'test', anchors: [{ step: 5, color: '#3b82f6' }] });

describe('buildContrastMatrix — shape', () => {
  test('produces an NxN grid matching the number of steps', () => {
    const matrix = buildContrastMatrix(scale.steps);
    expect(matrix.rows).toHaveLength(scale.steps.length);
    for (const row of matrix.rows) {
      expect(row).toHaveLength(scale.steps.length);
    }
  });

  test('stepIndices matches the input steps in order', () => {
    const matrix = buildContrastMatrix(scale.steps);
    expect(matrix.stepIndices).toEqual(scale.steps.map((s) => s.step));
  });

  test('every cell labels its own text/background step indices', () => {
    const matrix = buildContrastMatrix(scale.steps);
    matrix.rows.forEach((row, i) => {
      row.forEach((cell, j) => {
        expect(cell.textStep).toBe(scale.steps[i]!.step);
        expect(cell.backgroundStep).toBe(scale.steps[j]!.step);
      });
    });
  });
});

describe('buildContrastMatrix — WCAG ratio is symmetric', () => {
  test('ratio(i,j) equals ratio(j,i) for every pair', () => {
    const matrix = buildContrastMatrix(scale.steps);
    for (let i = 0; i < matrix.rows.length; i += 1) {
      for (let j = 0; j < matrix.rows.length; j += 1) {
        expect(matrix.rows[i]![j]!.ratio).toBeCloseTo(matrix.rows[j]![i]!.ratio, 10);
      }
    }
  });
});

describe('buildContrastMatrix — APCA is directional, not symmetric', () => {
  test('apcaLc(i,j) generally differs from apcaLc(j,i) for a genuinely light/dark pair', () => {
    const matrix = buildContrastMatrix(scale.steps);
    // Step 0 (lightest) vs the anchor step (much darker) — a real, large
    // lightness gap where APCA's normal/reverse polarity formulas diverge.
    const lightAsTextOnDark = matrix.rows[0]![5]!.apcaLc;
    const darkAsTextOnLight = matrix.rows[5]![0]!.apcaLc;
    expect(lightAsTextOnDark).not.toBeCloseTo(darkAsTextOnLight, 3);
  });

  test('is not simply a sign-flip of its transpose either', () => {
    const matrix = buildContrastMatrix(scale.steps);
    const a = matrix.rows[0]![5]!.apcaLc;
    const b = matrix.rows[5]![0]!.apcaLc;
    // If this were a plain negation, |a| would equal |b|. APCA's differing
    // normal/reverse exponents mean it generally isn't.
    expect(Math.abs(a)).not.toBeCloseTo(Math.abs(b), 3);
  });
});

describe('buildContrastMatrix — diagonal is self-contrast', () => {
  test('every diagonal cell has a WCAG ratio of exactly 1:1', () => {
    const matrix = buildContrastMatrix(scale.steps);
    matrix.rows.forEach((row, i) => {
      expect(row[i]!.ratio).toBeCloseTo(1, 10);
    });
  });

  test('every diagonal cell has an APCA Lc of exactly 0 (no contrast against itself)', () => {
    const matrix = buildContrastMatrix(scale.steps);
    matrix.rows.forEach((row, i) => {
      expect(row[i]!.apcaLc).toBe(0);
    });
  });
});
