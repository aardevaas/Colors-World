import { describe, expect, test } from 'vitest';
import { CVD_TYPES, auditContrast, parseColor, simulateCvd } from '@/lib/color-engine';
import { systemRoles } from '../colour';
import { EMPTY_SYSTEM } from '@/lib/system/defaults';
import type { System } from '@/lib/system/types';
import {
  BACKGROUND_ROLES,
  FOREGROUND_ROLES,
  REQUIRED_PAIRS,
  buildPairings,
  pairingsOn,
  requiredFailures,
  cvdRegressions,
} from '../pairings';

const systemWith = (hexes: readonly string[], mode: System['mode'] = 'dark'): System => ({
  ...EMPTY_SYSTEM,
  palette: hexes.map((hex, i) => ({ hex, oklch: parseColor(hex), addedAt: i })),
  anchorHex: hexes[0] ?? null,
  mode,
});

const roles = systemRoles(systemWith(['#0a5cff', '#ff6b35', '#1b1b1f', '#f5f5f7', '#00a67e']));
const pairings = buildPairings(roles);

describe('buildPairings', () => {
  test('covers every foreground on every background, less the self-pairs', () => {
    // `primary` and `accent` are both foregrounds AND backgrounds, so two of
    // the 24 combinations are a role on itself and are correctly skipped.
    const selfPairs = BACKGROUND_ROLES.filter((bg) => FOREGROUND_ROLES.includes(bg)).length;
    expect(selfPairs).toBe(2);
    expect(pairings).toHaveLength(FOREGROUND_ROLES.length * BACKGROUND_ROLES.length - selfPairs);
  });

  test('never pairs a role with itself — a ratio of 1:1 is not a finding', () => {
    for (const p of pairings) expect(p.fg).not.toBe(p.bg);
  });

  test('measures a real ratio for every pair', () => {
    for (const p of pairings) {
      expect(p.ratio).toBeGreaterThanOrEqual(1);
      expect(p.ratio).toBeLessThanOrEqual(21);
    }
  });

  test('grades against WCAG, largest band first', () => {
    for (const p of pairings) {
      if (p.ratio >= 7) expect(p.level).toBe('AAA');
      else if (p.ratio >= 4.5) expect(p.level).toBe('AA');
      else if (p.ratio >= 3) expect(p.level).toBe('AA large');
      else expect(p.level).toBe('fail');
    }
  });

  test('carries the worst ratio any colour-vision deficiency produces', () => {
    for (const p of pairings) {
      expect(p.cvdWorst).toBeGreaterThanOrEqual(1);
      expect(p.cvdWorst).toBeLessThanOrEqual(21);
      expect(CVD_TYPES).toContain(p.cvdWorstType);
    }
  });

  test('simulates the BACKGROUND too, not only the foreground', () => {
    // A deficiency shifts both colours. Simulating only the ink would still
    // produce plausible-looking numbers, so this pins the difference: for at
    // least one real pair the two implementations must disagree, and the
    // reported worst case must match the one that simulates both.
    const worstBoth = (p: (typeof pairings)[number]) =>
      Math.min(
        ...CVD_TYPES.map(
          (t) => auditContrast(simulateCvd(roles[p.fg].oklch, t), simulateCvd(roles[p.bg].oklch, t)).ratio
        )
      );
    const worstFgOnly = (p: (typeof pairings)[number]) =>
      Math.min(
        ...CVD_TYPES.map((t) => auditContrast(simulateCvd(roles[p.fg].oklch, t), roles[p.bg].oklch).ratio)
      );

    for (const p of pairings) expect(p.cvdWorst).toBeCloseTo(worstBoth(p), 6);
    expect(pairings.some((p) => Math.abs(worstBoth(p) - worstFgOnly(p)) > 0.01)).toBe(true);
  });

  test('names the deficiency that produced the worst reading', () => {
    for (const p of pairings) {
      const atWorst = auditContrast(
        simulateCvd(roles[p.fg].oklch, p.cvdWorstType),
        simulateCvd(roles[p.bg].oklch, p.cvdWorstType)
      ).ratio;
      // Either that type is genuinely the worst, or nothing was worse than the
      // deficiency-free reading and the default stands.
      expect(atWorst).toBeCloseTo(p.cvdWorst, 6);
    }
  });

  test('flags a pair that holds AA normally and loses it under a deficiency', () => {
    for (const p of pairings) {
      const regressed = p.ratio >= 4.5 && p.cvdWorst < 4.5;
      expect(p.cvdRegression).toBe(regressed);
    }
  });
});

describe('pairingsOn', () => {
  test('groups by background and keeps every foreground', () => {
    for (const bg of BACKGROUND_ROLES) {
      const on = pairingsOn(pairings, bg);
      const expected = FOREGROUND_ROLES.length - (FOREGROUND_ROLES.includes(bg) ? 1 : 0);
      expect(on).toHaveLength(expected);
      expect(on.every((p) => p.bg === bg)).toBe(true);
      expect(on.every((p) => p.fg !== bg)).toBe(true);
    }
  });

  test('orders strongest contrast first, so the usable option leads', () => {
    const on = pairingsOn(pairings, 'background');
    for (let i = 1; i < on.length; i++) {
      expect(on[i - 1]!.ratio).toBeGreaterThanOrEqual(on[i]!.ratio);
    }
  });
});

describe('REQUIRED_PAIRS', () => {
  test('are the pairs the interface cannot avoid using', () => {
    expect(REQUIRED_PAIRS).toContainEqual({ fg: 'text', bg: 'background' });
    expect(REQUIRED_PAIRS).toContainEqual({ fg: 'text', bg: 'surface' });
    expect(REQUIRED_PAIRS).toContainEqual({ fg: 'onPrimary', bg: 'primary' });
    expect(REQUIRED_PAIRS).toContainEqual({ fg: 'onAccent', bg: 'accent' });
  });

  test('every required pair actually exists in the matrix', () => {
    for (const r of REQUIRED_PAIRS) {
      expect(pairings.some((p) => p.fg === r.fg && p.bg === r.bg)).toBe(true);
    }
  });
});

describe('requiredFailures', () => {
  test('excludes a required pair that passes', () => {
    const passing = pairings.filter(
      (p) => p.ratio >= 4.5 && REQUIRED_PAIRS.some((r) => r.fg === p.fg && r.bg === p.bg)
    );
    expect(passing.length).toBeGreaterThan(0);
    for (const p of passing) expect(requiredFailures(pairings)).not.toContain(p);
  });

  test('reports only required pairs, and only those below AA', () => {
    for (const p of requiredFailures(pairings)) {
      expect(REQUIRED_PAIRS.some((r) => r.fg === p.fg && r.bg === p.bg)).toBe(true);
      expect(p.ratio).toBeLessThan(4.5);
    }
  });

  test('a palette of one near-black on one near-black fails its required pairs', () => {
    const bad = buildPairings(systemRoles(systemWith(['#101012', '#111113'])));
    expect(requiredFailures(bad).length).toBeGreaterThan(0);
  });
});

describe('cvdRegressions', () => {
  test('returns only pairs that pass normally and fail simulated', () => {
    for (const p of cvdRegressions(pairings)) {
      expect(p.ratio).toBeGreaterThanOrEqual(4.5);
      expect(p.cvdWorst).toBeLessThan(4.5);
    }
  });
});
