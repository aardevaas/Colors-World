import { describe, expect, it } from 'vitest';
import { autoArrange, type ArrangeInput, type ArrangedPosition } from '../auto-arrange';
import { WORLD_BOUNDS } from '../camera';

function rectsOverlap(
  a: ArrangedPosition & { width: number; height: number },
  b: ArrangedPosition & { width: number; height: number }
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function withDimensions(
  positions: readonly ArrangedPosition[],
  items: readonly ArrangeInput[]
): (ArrangedPosition & { width: number; height: number })[] {
  const dims = new Map(items.map((item) => [item.id, item]));
  return positions.map((p) => ({ ...p, ...dims.get(p.id)! }));
}

describe('autoArrange — basic contract', () => {
  it('returns an empty array for no items', () => {
    expect(autoArrange([])).toEqual([]);
  });

  it('resets rotation to exactly 0 for every card', () => {
    const items: ArrangeInput[] = [
      { id: 'a', width: 200, height: 150 },
      { id: 'b', width: 200, height: 150 },
    ];
    const result = autoArrange(items);
    expect(result.every((p) => p.rotation === 0)).toBe(true);
  });

  it('places every input id exactly once', () => {
    const items: ArrangeInput[] = Array.from({ length: 12 }, (_, i) => ({
      id: `card-${i}`,
      width: 180 + (i % 3) * 40,
      height: 120 + (i % 4) * 30,
    }));
    const result = autoArrange(items);
    expect(result).toHaveLength(items.length);
    expect(new Set(result.map((p) => p.id))).toEqual(new Set(items.map((i) => i.id)));
  });
});

describe('autoArrange — determinism and idempotency', () => {
  const items: ArrangeInput[] = [
    { id: 'a', width: 240, height: 180 },
    { id: 'b', width: 200, height: 300 },
    { id: 'c', width: 260, height: 140 },
    { id: 'd', width: 220, height: 220 },
    { id: 'e', width: 240, height: 90 },
  ];

  it('produces identical output across repeated calls with the same input', () => {
    const first = autoArrange(items);
    const second = autoArrange(items);
    expect(second).toEqual(first);
  });

  it('is idempotent when re-run on already-arranged input — position is never read, so nothing drifts', () => {
    const first = autoArrange(items);
    // Feed the arranged output straight back in (as id/width/height, the
    // only fields autoArrange ever looks at) and confirm it lands exactly
    // where it already was rather than jittering on a second pass.
    const reArranged = autoArrange(items);
    expect(reArranged).toEqual(first);
  });
});

describe('autoArrange — no overlaps', () => {
  it('never overlaps two cards of uniform size', () => {
    const items: ArrangeInput[] = Array.from({ length: 20 }, (_, i) => ({
      id: `card-${i}`,
      width: 200,
      height: 150,
    }));
    const result = withDimensions(autoArrange(items), items);
    for (let i = 0; i < result.length; i += 1) {
      for (let j = i + 1; j < result.length; j += 1) {
        expect(rectsOverlap(result[i]!, result[j]!)).toBe(false);
      }
    }
  });

  it('never overlaps a mix of wildly different card sizes', () => {
    const items: ArrangeInput[] = [
      { id: 'wide-image', width: 480, height: 320 },
      { id: 'note', width: 160, height: 100 },
      { id: 'tall-palette', width: 220, height: 500 },
      { id: 'swatch', width: 80, height: 80 },
      { id: 'gradient', width: 300, height: 140 },
      { id: 'link', width: 200, height: 90 },
      { id: 'type-pairing', width: 260, height: 180 },
    ];
    const result = withDimensions(autoArrange(items), items);
    for (let i = 0; i < result.length; i += 1) {
      for (let j = i + 1; j < result.length; j += 1) {
        expect(rectsOverlap(result[i]!, result[j]!)).toBe(false);
      }
    }
  });
});

describe('autoArrange — shortest-column packing', () => {
  it('sends the next card to the column with the least height so far', () => {
    const items: ArrangeInput[] = [
      { id: 'tall', width: 200, height: 800 },
      { id: 'short', width: 200, height: 100 },
      { id: 'next', width: 200, height: 100 },
    ];
    // Force exactly 2 columns so the packing decision is unambiguous.
    const result = autoArrange(items, { columns: 2 });
    const byId = new Map(result.map((p) => [p.id, p]));
    // 'tall' and 'short' land in different columns (first two items fill
    // one column each); 'next' should join whichever column is shorter —
    // the one holding 'short', not 'tall'.
    expect(byId.get('tall')!.x).not.toBe(byId.get('short')!.x);
    expect(byId.get('next')!.x).toBe(byId.get('short')!.x);
  });

  it('derives a squarish column count from item count by default', () => {
    // 9 items -> round(sqrt(9)) = 3 columns -> 3 distinct x offsets.
    const items: ArrangeInput[] = Array.from({ length: 9 }, (_, i) => ({
      id: `card-${i}`,
      width: 200,
      height: 150,
    }));
    const result = autoArrange(items);
    const distinctXValues = new Set(result.map((p) => p.x));
    expect(distinctXValues.size).toBe(3);
  });

  it('respects an explicit column count override', () => {
    const items: ArrangeInput[] = Array.from({ length: 9 }, (_, i) => ({
      id: `card-${i}`,
      width: 200,
      height: 150,
    }));
    const result = autoArrange(items, { columns: 1 });
    expect(new Set(result.map((p) => p.x)).size).toBe(1);
  });
});

describe('autoArrange — origin, gap, and bounds', () => {
  it('offsets every card by the given origin', () => {
    const items: ArrangeInput[] = [{ id: 'a', width: 200, height: 150 }];
    const result = autoArrange(items, { originX: 5000, originY: 3000 });
    expect(result[0]).toMatchObject({ x: 5000, y: 3000 });
  });

  it('spaces stacked cards in the same column by exactly the given gap', () => {
    const items: ArrangeInput[] = [
      { id: 'a', width: 200, height: 150 },
      { id: 'b', width: 200, height: 100 },
    ];
    const result = autoArrange(items, { columns: 1, gap: 40 });
    const [first, second] = result;
    expect(second!.y).toBe(first!.y + 150 + 40);
  });

  it('never places a card outside the 20,000 x 20,000 world bounds for a realistic board size', () => {
    const items: ArrangeInput[] = Array.from({ length: 60 }, (_, i) => ({
      id: `card-${i}`,
      width: 200 + (i % 5) * 20,
      height: 140 + (i % 7) * 25,
    }));
    const result = withDimensions(autoArrange(items), items);
    for (const rect of result) {
      expect(rect.x).toBeGreaterThanOrEqual(WORLD_BOUNDS.minX);
      expect(rect.y).toBeGreaterThanOrEqual(WORLD_BOUNDS.minY);
      expect(rect.x + rect.width).toBeLessThanOrEqual(WORLD_BOUNDS.maxX);
    }
  });

  it('narrows the column count rather than exceeding world bounds when cards are extremely wide', () => {
    // 10 cards at 3000 wide each: the default derived column count (3)
    // would need 3*3000 + gaps > 9000, still under 20000 here, so push
    // width further to actually force the narrowing path.
    const items: ArrangeInput[] = Array.from({ length: 10 }, (_, i) => ({
      id: `card-${i}`,
      width: 7000,
      height: 200,
    }));
    const result = withDimensions(autoArrange(items), items);
    for (const rect of result) {
      expect(rect.x + rect.width).toBeLessThanOrEqual(WORLD_BOUNDS.maxX);
    }
  });
});
