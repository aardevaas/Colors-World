import { describe, expect, test } from 'vitest';
import { EMPTY_SYSTEM } from '@/lib/system/defaults';
import { parseColor } from '@/lib/color-engine';
import type { BrandState } from '../types';
import {
  CAP_HEIGHT_TO_DISTANCE,
  PRINT_FLOOR_PT,
  STATIONERY,
  ptToMm,
  signSizes,
  stationerySpecs,
  underPrintFloor,
} from '../collateral';

const stateWith = (patch: Partial<typeof EMPTY_SYSTEM.type> = {}): BrandState => ({
  system: {
    ...EMPTY_SYSTEM,
    palette: ['#0a5cff', '#1b1b1f', '#f5f5f7'].map((hex, i) => ({
      hex,
      oklch: parseColor(hex),
      addedAt: i,
    })),
    anchorHex: '#0a5cff',
    type: { ...EMPTY_SYSTEM.type, ...patch },
  },
  project: null,
});

describe('STATIONERY', () => {
  test('is the three pieces a manual actually dimensions', () => {
    expect(STATIONERY.map((p) => p.id)).toEqual(['business-card', 'letterhead', 'envelope']);
  });

  test('every format cites the standard it comes from', () => {
    for (const p of STATIONERY) {
      expect(p.standard, p.id).toMatch(/ISO/);
      expect(p.widthMm).toBeGreaterThan(0);
      expect(p.heightMm).toBeGreaterThan(0);
    }
  });

  test('states the real ISO dimensions', () => {
    const card = STATIONERY.find((p) => p.id === 'business-card')!;
    expect([card.widthMm, card.heightMm]).toEqual([85.6, 53.98]);
    const a4 = STATIONERY.find((p) => p.id === 'letterhead')!;
    expect([a4.widthMm, a4.heightMm]).toEqual([210, 297]);
    const dl = STATIONERY.find((p) => p.id === 'envelope')!;
    expect([dl.widthMm, dl.heightMm]).toEqual([220, 110]);
  });
});

describe('ptToMm', () => {
  test('converts at 72 points to the inch', () => {
    expect(ptToMm(72)).toBeCloseTo(25.4, 6);
    expect(ptToMm(12)).toBeCloseTo(4.2333, 3);
  });
});

describe('stationerySpecs', () => {
  const specs = stationerySpecs(stateWith());

  test('returns one spec per piece', () => {
    expect(specs).toHaveLength(STATIONERY.length);
  });

  test('converts the system’s own ladder into points', () => {
    const rungs = specs[0]!.ladder;
    expect(rungs.length).toBeGreaterThan(0);
    const body = rungs.find((r) => r.token === 'body')!;
    // 1rem is 16px, and 16px at 96dpi is 12pt.
    expect(body.pt).toBe(12);
    // Rounded to two decimals on purpose — finer than a printer can hold.
    expect(body.mm).toBe(4.23);
  });

  test('the ladder is the same for every piece — it is the brand’s, not the card’s', () => {
    const first = JSON.stringify(specs[0]!.ladder);
    for (const s of specs) expect(JSON.stringify(s.ladder)).toBe(first);
  });

  test('answers whether the body face may be printed at all', () => {
    for (const s of specs) {
      expect(s.printLicence).not.toBeUndefined();
      expect(typeof s.printLicence!.allowed).toBe('boolean');
    }
  });

  test('carries the ink and ground the piece is set in', () => {
    for (const s of specs) {
      expect(s.ink).toMatch(/^#[0-9a-f]{6}$/i);
      expect(s.ground).toMatch(/^#[0-9a-f]{6}$/i);
      expect(s.ink).not.toBe(s.ground);
    }
  });
});

describe('underPrintFloor', () => {
  test('flags the rungs that set below the print floor at the shipped default', () => {
    const under = underPrintFloor(stationerySpecs(stateWith())[0]!.ladder);
    // caption is 0.6375rem — 10.2px — 7.65pt, under an 8pt floor.
    expect(under.map((r) => r.token)).toContain('caption');
    for (const r of under) expect(r.pt).toBeLessThan(PRINT_FLOOR_PT);
  });

  test('a larger base lifts the whole ladder clear', () => {
    expect(underPrintFloor(stationerySpecs(stateWith({ baseRem: 1.5 }))[0]!.ladder)).toHaveLength(0);
  });

  test('a rung exactly ON the floor is not under it', () => {
    // Built directly rather than through a base size, because the ladder
    // rounds to a tenth of a pixel and would never land exactly on 8pt.
    const ladder = [
      { token: 'caption' as const, pt: PRINT_FLOOR_PT, mm: ptToMm(PRINT_FLOOR_PT) },
      { token: 'small' as const, pt: PRINT_FLOOR_PT - 0.01, mm: 0 },
      { token: 'body' as const, pt: PRINT_FLOOR_PT + 0.01, mm: 0 },
    ];
    expect(underPrintFloor(ladder).map((r) => r.token)).toEqual(['small']);
  });

  test('never flags a rung at or above the floor', () => {
    for (const r of underPrintFloor(stationerySpecs(stateWith({ baseRem: 0.6 }))[0]!.ladder)) {
      expect(r.pt).toBeLessThan(PRINT_FLOOR_PT);
    }
  });
});

describe('signSizes', () => {
  test('is one inch of cap height per ten feet, in metric', () => {
    const sizes = signSizes();
    // 3048mm of distance for 25.4mm of letter — 1:120.
    expect(CAP_HEIGHT_TO_DISTANCE).toBeCloseTo(25.4 / 3048, 10);
    const at3 = sizes.find((s) => s.distanceM === 3)!;
    expect(at3.capHeightMm).toBe(25);
  });

  test('scales linearly with distance', () => {
    // Each size rounds to two decimals independently, so 83.33 × 3 is 249.99
    // while 30m rounds to 250. Assert against the ratio, not against a
    // multiple of another rounded figure.
    for (const s of signSizes()) {
      expect(s.capHeightMm).toBeCloseTo(s.distanceM * 1000 * CAP_HEIGHT_TO_DISTANCE, 2);
    }
  });

  test('covers the distances a scheme is actually specified at', () => {
    expect(signSizes().map((s) => s.distanceM)).toEqual([3, 10, 30, 100]);
  });

  test('every size is a real millimetre figure', () => {
    for (const s of signSizes()) {
      expect(s.capHeightMm).toBeGreaterThan(0);
      expect(Number.isFinite(s.capHeightMm)).toBe(true);
    }
  });
});
