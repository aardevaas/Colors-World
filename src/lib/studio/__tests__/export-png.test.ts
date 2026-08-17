import { describe, expect, it } from 'vitest';
import { computeExportBounds, type ExportRect } from '../export-png';

describe('computeExportBounds', () => {
  it('returns a zero-size box at the origin for an empty board', () => {
    expect(computeExportBounds([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('pads a single rect evenly on every side', () => {
    const rect: ExportRect = { x: 100, y: 200, width: 300, height: 150 };
    const bounds = computeExportBounds([rect], 40);
    expect(bounds).toEqual({ x: 60, y: 160, width: 380, height: 230 });
  });

  it('frames the union of several scattered rects', () => {
    const rects: ExportRect[] = [
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 500, y: 300, width: 100, height: 100 },
      { x: 200, y: -150, width: 50, height: 50 },
    ];
    const bounds = computeExportBounds(rects, 0);
    // union: x from 0 to 600, y from -150 to 400
    expect(bounds).toEqual({ x: 0, y: -150, width: 600, height: 550 });
  });

  it('defaults to a sensible padding when none is given', () => {
    const rect: ExportRect = { x: 0, y: 0, width: 100, height: 100 };
    const bounds = computeExportBounds([rect]);
    expect(bounds.x).toBeLessThan(0);
    expect(bounds.y).toBeLessThan(0);
    expect(bounds.width).toBeGreaterThan(100);
    expect(bounds.height).toBeGreaterThan(100);
  });

  it('is unaffected by input order', () => {
    const a: ExportRect = { x: 10, y: 10, width: 20, height: 20 };
    const b: ExportRect = { x: 300, y: 300, width: 20, height: 20 };
    expect(computeExportBounds([a, b], 5)).toEqual(computeExportBounds([b, a], 5));
  });
});
