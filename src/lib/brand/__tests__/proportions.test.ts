import { describe, expect, test } from 'vitest';
import type { SemanticRole } from '@/lib/roles/semantic-roles';
import { coverage, compareToTarget, type Region, type Surface } from '../proportions';

const full = (role: SemanticRole): Region => ({ role, x: 0, y: 0, w: 1, h: 1 });
const surface = (regions: readonly Region[]): Surface => ({
  id: 'test',
  name: 'Test',
  channel: 'web',
  regions,
  measuredAt: '2026-08-24',
  measuredViewport: '910×710',
});

describe('coverage', () => {
  test('one opaque region covering everything is 100% of that role', () => {
    expect(coverage(surface([full('background')]))).toEqual({ background: 1 });
  });

  test('an opaque region on top REPLACES what is under it, never adds to it', () => {
    const c = coverage(surface([full('background'), { role: 'primary', x: 0, y: 0, w: 0.5, h: 1 }]));
    expect(c.primary).toBeCloseTo(0.5, 10);
    expect(c.background).toBeCloseTo(0.5, 10);
    expect(Object.values(c).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });

  test('two regions of the same role add up', () => {
    const c = coverage(
      surface([
        full('background'),
        { role: 'primary', x: 0, y: 0, w: 0.25, h: 1 },
        { role: 'primary', x: 0.75, y: 0, w: 0.25, h: 1 },
      ])
    );
    expect(c.primary).toBeCloseTo(0.5, 10);
  });

  test('overlapping regions of the same role are not double counted', () => {
    const c = coverage(
      surface([
        full('background'),
        { role: 'primary', x: 0, y: 0, w: 0.5, h: 1 },
        { role: 'primary', x: 0.25, y: 0, w: 0.5, h: 1 },
      ])
    );
    expect(c.primary).toBeCloseTo(0.75, 10);
  });

  test('a half-transparent fill splits its area with what shows through', () => {
    const c = coverage(
      surface([full('background'), { role: 'primary', x: 0, y: 0, w: 1, h: 1, alpha: 0.5 }])
    );
    expect(c.primary).toBeCloseTo(0.5, 10);
    expect(c.background).toBeCloseTo(0.5, 10);
  });

  test('translucent fills composite in paint order, front to back', () => {
    // 0.5 primary over 0.5 accent over opaque background.
    const c = coverage(
      surface([
        full('background'),
        { role: 'accent', x: 0, y: 0, w: 1, h: 1, alpha: 0.5 },
        { role: 'primary', x: 0, y: 0, w: 1, h: 1, alpha: 0.5 },
      ])
    );
    expect(c.primary).toBeCloseTo(0.5, 10);
    expect(c.accent).toBeCloseTo(0.25, 10);
    expect(c.background).toBeCloseTo(0.25, 10);
    expect(Object.values(c).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });

  test('alpha 0 contributes nothing and hides nothing', () => {
    const c = coverage(
      surface([full('background'), { role: 'primary', x: 0, y: 0, w: 1, h: 1, alpha: 0 }])
    );
    expect(c.background).toBeCloseTo(1, 10);
    expect(c.primary ?? 0).toBe(0);
  });

  test('an uncovered surface reports less than 100%, rather than inventing a fill', () => {
    const c = coverage(surface([{ role: 'primary', x: 0, y: 0, w: 0.5, h: 0.5 }]));
    expect(c.primary).toBeCloseTo(0.25, 10);
    expect(Object.values(c).reduce((a, b) => a + b, 0)).toBeCloseTo(0.25, 10);
  });

  test('regions are clipped to the surface, not counted outside it', () => {
    const c = coverage(surface([{ role: 'primary', x: 0.5, y: 0, w: 1, h: 1 }]));
    expect(c.primary).toBeCloseTo(0.5, 10);
  });

  test('an empty surface is empty, not a crash', () => {
    expect(coverage(surface([]))).toEqual({});
  });
});

describe('compareToTarget', () => {
  const measured = { primary: 0.08, accent: 0.05, background: 0.87 } as Partial<Record<SemanticRole, number>>;

  test('reports the shortfall against a floor', () => {
    const rows = compareToTarget(measured, { primary: { min: 0.25 } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ role: 'primary', measured: 0.08, verdict: 'under' });
  });

  test('a role inside its band passes', () => {
    expect(compareToTarget(measured, { accent: { min: 0.02, max: 0.1 } })[0]?.verdict).toBe('within');
  });

  test('a role above its ceiling is over, not a pass', () => {
    expect(compareToTarget(measured, { background: { min: 0.1, max: 0.5 } })[0]?.verdict).toBe('over');
  });

  test('a role the surface does not use at all measures zero rather than being skipped', () => {
    const rows = compareToTarget(measured, { surface: { min: 0.1 } });
    expect(rows[0]).toMatchObject({ role: 'surface', measured: 0, verdict: 'under' });
  });

  test('rows come back in the order the target declares them', () => {
    const rows = compareToTarget(measured, { accent: { min: 0 }, primary: { min: 0 } });
    expect(rows.map((r) => r.role)).toEqual(['accent', 'primary']);
  });
});
