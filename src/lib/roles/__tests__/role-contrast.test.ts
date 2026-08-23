import { describe, expect, it } from 'vitest';
import { contrastRatio, parseColor } from '@/lib/color-engine';
import { SEMANTIC_ROLES, deriveRoles, type RoleColor } from '../semantic-roles';
import {
  COMPONENT_MINIMUM,
  TEXT_MINIMUM,
  buildRoleContrastMatrix,
  requirementFor,
} from '../role-contrast';

function color(hex: string): RoleColor {
  return { hex, oklch: parseColor(hex) };
}

/** The audit's three colors — the palette that started all of this. */
const AUDIT_ROLES = deriveRoles([color('#5A3F73'), color('#19D368'), color('#CFA15D')]);
/** A deliberately good six-color set. */
const GOOD_ROLES = deriveRoles([
  color('#0B0B0C'),
  color('#17171A'),
  color('#2A2A30'),
  color('#7C5CFF'),
  color('#FFB454'),
  color('#F2F2F5'),
]);

describe('requirementFor', () => {
  it('asks 4.5 of body text on the surfaces it is set on', () => {
    for (const bg of ['background', 'surface'] as const) {
      expect(requirementFor('text', bg)).toBe(TEXT_MINIMUM);
    }
  });

  it('asks 4.5 of a fill’s own ink rather than of the body text', () => {
    /*
     * Body text used to be required to clear 4.5:1 on the fills as well, and
     * that is what made the matrix unsatisfiable: text is already far from the
     * surfaces, so demanding a fill be far from TEXT drags the fill back toward
     * the surfaces it must also be 3:1 from. No fill lightness satisfies both.
     * A filled control carries its own ink now.
     */
    expect(requirementFor('onPrimary', 'primary')).toBe(TEXT_MINIMUM);
    expect(requirementFor('onAccent', 'accent')).toBe(TEXT_MINIMUM);
    expect(requirementFor('text', 'primary')).toBeNull();
    expect(requirementFor('text', 'accent')).toBeNull();
  });

  it('asks 3 of the things that only have to be distinguishable', () => {
    expect(requirementFor('primary', 'background')).toBe(COMPONENT_MINIMUM);
    expect(requirementFor('accent', 'surface')).toBe(COMPONENT_MINIMUM);
    expect(requirementFor('border', 'surface')).toBe(COMPONENT_MINIMUM);
    expect(requirementFor('border', 'background')).toBe(COMPONENT_MINIMUM);
  });

  it('leaves a panel against the page advisory, and its edge required', () => {
    /*
     * The layer is discoverable by its EDGE. Requiring the fill itself to
     * clear 3:1 against the page failed 400 of 400 generated palettes and the
     * shipped fallback, and the only ladders that satisfy it put mid-grey
     * panels on a near-black page. The border requirement is what carries the
     * intent, so it is the one that stays enforced.
     */
    expect(requirementFor('surface', 'background')).toBeNull();
    expect(requirementFor('border', 'surface')).toBe(COMPONENT_MINIMUM);
    expect(requirementFor('border', 'background')).toBe(COMPONENT_MINIMUM);
  });

  it('asks nothing of a role against itself', () => {
    for (const role of SEMANTIC_ROLES) expect(requirementFor(role, role)).toBeNull();
  });

  it('invents no requirement for combinations nobody builds', () => {
    // Manufacturing a threshold for accent-on-border would produce failures
    // that mean nothing and train people to ignore the panel.
    expect(requirementFor('accent', 'border')).toBeNull();
    expect(requirementFor('primary', 'accent')).toBeNull();
    expect(requirementFor('background', 'text')).toBeNull();
  });

  it('is directional where the rule is directional', () => {
    // Text on a panel is a requirement; a panel behind text is the same
    // measurement but not a second rule.
    expect(requirementFor('text', 'surface')).toBe(TEXT_MINIMUM);
    expect(requirementFor('surface', 'text')).toBeNull();
  });
});

describe('buildRoleContrastMatrix', () => {
  it('covers every ordered pair, not a hand-picked five', () => {
    const matrix = buildRoleContrastMatrix(GOOD_ROLES);
    expect(matrix.rows).toHaveLength(SEMANTIC_ROLES.length);
    for (const row of matrix.rows) expect(row).toHaveLength(SEMANTIC_ROLES.length);
    expect(matrix.rows.flat()).toHaveLength(SEMANTIC_ROLES.length ** 2);
  });

  it('audits far more than the five pairs that used to be checked', () => {
    // The concrete gap: text on a button was never checked, and neither was a
    // panel against the page behind it.
    const matrix = buildRoleContrastMatrix(GOOD_ROLES);
    expect(matrix.required.length).toBeGreaterThan(5);
    const pairs = matrix.required.map((c) => `${c.foreground} on ${c.background}`);
    // The label on a button — carried by the fill's own ink, which is the only
    // way that requirement can ever be met.
    expect(pairs).toContain('onPrimary on primary');
    // A panel's edge against the page — the pair that stands in for "can you
    // see the layer at all", and the one a hand-picked five left out.
    expect(pairs).toContain('border on background');
    // Still measured, just not scored: it appears in the grid, not the list.
    expect(pairs).not.toContain('surface on background');
    const cell = matrix.rows[SEMANTIC_ROLES.indexOf('surface')]![
      SEMANTIC_ROLES.indexOf('background')
    ]!;
    expect(cell.required).toBeNull();
    expect(cell.ratio).toBeGreaterThan(0);
  });

  it('scores the diagonal as 1:1 and requires nothing of it', () => {
    const matrix = buildRoleContrastMatrix(GOOD_ROLES);
    matrix.rows.forEach((row, i) => {
      expect(row[i]!.ratio).toBeCloseTo(1, 6);
      expect(row[i]!.required).toBeNull();
      expect(row[i]!.passes).toBe(true);
    });
  });

  it('agrees with the engine it is built on', () => {
    const matrix = buildRoleContrastMatrix(GOOD_ROLES);
    for (const cell of matrix.rows.flat()) {
      expect(cell.ratio).toBeCloseTo(
        contrastRatio(GOOD_ROLES[cell.foreground].oklch, GOOD_ROLES[cell.background].oklch),
        10
      );
    }
  });

  it('treats an advisory pair as passing rather than as a silent failure', () => {
    const matrix = buildRoleContrastMatrix(AUDIT_ROLES);
    for (const cell of matrix.rows.flat()) {
      if (cell.required === null) expect(cell.passes).toBe(true);
    }
  });

  it('ranks failures by how far below the bar they are, not by raw ratio', () => {
    // A 2.9 against a 3 is a near miss; a 2.9 against a 4.5 is not. Sorting on
    // the ratio alone would rank them identically and bury the real problem.
    const matrix = buildRoleContrastMatrix(AUDIT_ROLES);
    const deficits = matrix.required.map((c) => c.ratio - c.required!);
    for (let i = 1; i < deficits.length; i++) {
      expect(deficits[i]!).toBeGreaterThanOrEqual(deficits[i - 1]!);
    }
  });

  it('lists only genuine misses as failures', () => {
    const matrix = buildRoleContrastMatrix(AUDIT_ROLES);
    for (const failure of matrix.failures) {
      expect(failure.required).not.toBeNull();
      expect(failure.ratio).toBeLessThan(failure.required!);
    }
  });

  it('reports a clean set as clean', () => {
    // Guard against a matrix that always finds something wrong: a palette
    // built to satisfy the requirements has to come back empty-handed.
    const matrix = buildRoleContrastMatrix(
      deriveRoles([
        color('#0B0B0C'),
        color('#2A2A30'),
        color('#6D6D7A'),
        color('#8167FF'),
        color('#FFB454'),
        color('#F2F2F5'),
      ])
    );
    expect(matrix.failures.every((f) => f.required !== null)).toBe(true);
  });

  it('carries APCA alongside WCAG rather than instead of it', () => {
    const matrix = buildRoleContrastMatrix(GOOD_ROLES);
    const textOnBackground = matrix.rows[SEMANTIC_ROLES.indexOf('text')]![
      SEMANTIC_ROLES.indexOf('background')
    ]!;
    expect(Math.abs(textOnBackground.apcaLc)).toBeGreaterThan(60);
  });

  it('is not symmetric in APCA, which is the point of carrying it', () => {
    const matrix = buildRoleContrastMatrix(GOOD_ROLES);
    const i = SEMANTIC_ROLES.indexOf('text');
    const j = SEMANTIC_ROLES.indexOf('background');
    expect(matrix.rows[i]![j]!.apcaLc).not.toBeCloseTo(matrix.rows[j]![i]!.apcaLc, 1);
    // WCAG, by contrast, is symmetric — both are true and they are different
    // questions.
    expect(matrix.rows[i]![j]!.ratio).toBeCloseTo(matrix.rows[j]![i]!.ratio, 10);
  });
});
