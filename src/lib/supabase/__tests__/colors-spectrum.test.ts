import { describe, expect, test } from 'vitest';
import { getSpectrumPage, getSpectrumWindow } from '../colors';
import { createFakeSupabaseClient } from './fake-client';

function spectrumRow(index: number, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: `row-${index}`,
    name: `Colour ${index}`,
    hex: '#336699',
    oklch_l: 0.5,
    oklch_c: 0.1,
    oklch_h: index, // hue tracks index by default — easy to reason about in assertions
    spectrum_index: index,
    ...overrides,
  };
}

const SEEDED = Array.from({ length: 100 }, (_, i) => spectrumRow(i));

describe('getSpectrumWindow', () => {
  test('returns exactly the requested contiguous range, ordered by spectrum_index', async () => {
    const client = createFakeSupabaseClient({ colors: SEEDED });
    const rows = await getSpectrumWindow(10, 5, client);
    expect(rows.map((r) => r.spectrumIndex)).toEqual([10, 11, 12, 13, 14]);
  });

  test('is exclusive of the end boundary (startIndex + count)', async () => {
    const client = createFakeSupabaseClient({ colors: SEEDED });
    const rows = await getSpectrumWindow(0, 3, client);
    expect(rows.map((r) => r.spectrumIndex)).toEqual([0, 1, 2]);
  });

  test('returns fewer rows than requested when the window runs past the end', async () => {
    const client = createFakeSupabaseClient({ colors: SEEDED });
    const rows = await getSpectrumWindow(97, 10, client);
    expect(rows.map((r) => r.spectrumIndex)).toEqual([97, 98, 99]);
  });

  test('maps oklch_l/c/h into a nested Oklch object', async () => {
    const client = createFakeSupabaseClient({ colors: SEEDED });
    const [row] = await getSpectrumWindow(0, 1, client);
    expect(row!.oklch).toEqual({ l: 0.5, c: 0.1, h: 0 });
  });
});

describe('getSpectrumPage', () => {
  test('the first page (afterIndex undefined) starts at spectrum_index 0', async () => {
    const client = createFakeSupabaseClient({ colors: SEEDED });
    const rows = await getSpectrumPage(undefined, 5, {}, client);
    expect(rows.map((r) => r.spectrumIndex)).toEqual([0, 1, 2, 3, 4]);
  });

  test('a subsequent page picks up strictly after the cursor', async () => {
    const client = createFakeSupabaseClient({ colors: SEEDED });
    const rows = await getSpectrumPage(4, 3, {}, client);
    expect(rows.map((r) => r.spectrumIndex)).toEqual([5, 6, 7]);
  });

  test('a lightness filter excludes non-matching rows', async () => {
    const withPastel = [...SEEDED, spectrumRow(100, { oklch_l: 0.95, spectrum_index: 100 })];
    const client = createFakeSupabaseClient({ colors: withPastel });
    const rows = await getSpectrumPage(undefined, 200, { minLightness: 0.9 }, client);
    expect(rows.map((r) => r.spectrumIndex)).toEqual([100]);
  });

  test('a hue-range filter keeps only rows inside the range', async () => {
    const client = createFakeSupabaseClient({ colors: SEEDED });
    const rows = await getSpectrumPage(undefined, 200, { minHue: 50, maxHue: 52 }, client);
    expect(rows.map((r) => r.spectrumIndex)).toEqual([50, 51, 52]);
  });
});
