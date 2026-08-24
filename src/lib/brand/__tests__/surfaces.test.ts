import { describe, expect, test } from 'vitest';
import { SEMANTIC_ROLES } from '@/lib/roles/semantic-roles';
import { coverage } from '../proportions';
import { REFERENCE_SURFACES, surfaceById } from '../surfaces';

describe('reference surfaces', () => {
  test('there are five, each with a distinct id', () => {
    const ids = REFERENCE_SURFACES.map((s) => s.id);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
  });

  test.each(REFERENCE_SURFACES.map((s) => [s.name, s] as const))(
    '%s is fully covered — a deleted region cannot pass silently',
    (_name, surface) => {
      const total = Object.values(coverage(surface)).reduce((a, b) => a + b, 0);
      // Exactly 1: every surface starts with an opaque full-bleed ground, so
      // anything short of 100% means a region was lost or a rect mistyped.
      expect(total).toBeCloseTo(1, 6);
    }
  );

  test.each(REFERENCE_SURFACES.map((s) => [s.name, s] as const))(
    '%s uses only real semantic roles',
    (_name, surface) => {
      for (const r of surface.regions) expect(SEMANTIC_ROLES).toContain(r.role);
    }
  );

  test.each(REFERENCE_SURFACES.map((s) => [s.name, s] as const))(
    '%s has sane normalised geometry',
    (_name, surface) => {
      for (const r of surface.regions) {
        expect(r.w).toBeGreaterThan(0);
        expect(r.h).toBeGreaterThan(0);
        // Regions may start off-surface (the editorial glow does) but a rect
        // entirely outside the frame is a transcription error, not a design.
        expect(r.x).toBeLessThan(1);
        expect(r.y).toBeLessThan(1);
        expect(r.x + r.w).toBeGreaterThan(0);
        expect(r.y + r.h).toBeGreaterThan(0);
      }
    }
  );

  test('every non-opaque region explains where its alpha came from', () => {
    for (const s of REFERENCE_SURFACES) {
      for (const r of s.regions) {
        if (r.alpha !== undefined && r.alpha < 1) {
          expect(r.alpha).toBeGreaterThan(0);
          // An unexplained 0.091 is indistinguishable from a guess.
          expect(r.note, `${s.id}/${r.role}`).toBeTruthy();
        }
      }
    }
  });

  test('each surface records when and at what size it was measured', () => {
    for (const s of REFERENCE_SURFACES) {
      expect(s.measuredAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.measuredViewport).toMatch(/^\d+×\d+$/);
    }
  });

  /*
   * The numbers below were read off the live DOM at 910×710 on 2026-08-24 —
   * getBoundingClientRect per element, computed background-color matched to
   * the resolved --ui-* role variables. They are pinned so that a change to a
   * template's layout fails here instead of quietly restating the guideline's
   * proportions. If a template genuinely changed, re-measure and update both.
   */
  test.each([
    ['dashboard', { surface: 52.03, primary: 26.53, background: 16.72, accent: 4.72 }],
    ['commerce', { background: 83.7, surface: 7.61, primary: 4.98, accent: 3.65, border: 0.06 }],
    ['editorial', { background: 94.91, primary: 4.12, surface: 0.63, accent: 0.34 }],
    ['mobile', { background: 91.41, surface: 7.95, border: 0.31, primary: 0.19, accent: 0.14 }],
    ['email', { background: 77.75, surface: 21.28, primary: 0.9, border: 0.05, accent: 0.02 }],
  ] as const)('%s matches the geometry measured in the browser', (id, expected) => {
    const c = coverage(surfaceById(id)!);
    for (const [role, pct] of Object.entries(expected)) {
      expect(((c[role as keyof typeof c] ?? 0) * 100).toFixed(2)).toBe(pct.toFixed(2));
    }
  });

  test('surfaceById returns nothing for an id that does not exist', () => {
    expect(surfaceById('nope')).toBeUndefined();
  });
});
