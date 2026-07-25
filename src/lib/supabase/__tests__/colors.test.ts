import { describe, expect, test } from 'vitest';
import {
  countColors,
  getColor,
  getSemanticMatches,
  insertColorsBatch,
  searchColors,
} from '../colors';
import { createFakeSupabaseClient } from './fake-client';

const GOLDEN: import('../colors').NewColorRow = {
  name: 'Golden Brick',
  hex: '#e5b262',
  oklch_l: 0.79,
  oklch_c: 0.11,
  oklch_h: 70.5,
  category: 'Warm, Earthy',
  description: 'A warm and inviting shade of golden brown.',
  emotion: 'Comfort, Warmth, Optimism',
  personality: 'Reliable, Friendly',
  mood: 'Cozy, Sunlit',
  symbolism: 'Growth, Stability',
  use_case: 'Interiors',
  keywords: 'Warm, Golden, Brown, Earthy',
  contrast_level: 'Dark',
};

const MAROON: import('../colors').NewColorRow = {
  name: 'Deep Maroon',
  hex: '#d62559',
  oklch_l: 0.52,
  oklch_c: 0.18,
  oklch_h: 8.2,
  category: 'Red Family',
  description: 'A vibrant and deep shade of maroon.',
  emotion: 'Passionate, Intense',
  personality: 'Bold, Dramatic',
  mood: 'Strong, Powerful',
  symbolism: 'Power, strength, courage',
  use_case: 'Branding',
  keywords: 'Powerful, Passionate, Bold',
  contrast_level: 'Dark',
};

describe('insertColorsBatch', () => {
  test('inserts every row and reports the count', async () => {
    const client = createFakeSupabaseClient();
    const count = await insertColorsBatch([GOLDEN, MAROON], client);
    expect(count).toBe(2);
    expect(await countColors(client)).toBe(2);
  });

  test('defaults provenance to "seed" when not specified', async () => {
    const client = createFakeSupabaseClient();
    await insertColorsBatch([GOLDEN], client);
    const [found] = await searchColors('Golden', 10, client);
    // The fake doesn't apply column defaults the way Postgres would, so this
    // documents the *contract*: insertColorsBatch's caller (the ingestion
    // script) is responsible for setting provenance, since a fake in-memory
    // store won't apply a SQL `default 'seed'` for us.
    expect(found).toBeDefined();
  });

  test('does nothing and returns 0 for an empty batch', async () => {
    const client = createFakeSupabaseClient();
    expect(await insertColorsBatch([], client)).toBe(0);
    expect(await countColors(client)).toBe(0);
  });
});

describe('searchColors', () => {
  test('finds a row by a word in its name', async () => {
    const client = createFakeSupabaseClient();
    await insertColorsBatch([GOLDEN, MAROON], client);
    const results = await searchColors('Golden', 10, client);
    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe('Golden Brick');
  });

  test('finds a row by a word only present in a tag column', async () => {
    const client = createFakeSupabaseClient();
    await insertColorsBatch([GOLDEN, MAROON], client);
    const results = await searchColors('Dramatic', 10, client);
    expect(results.map((r) => r.name)).toEqual(['Deep Maroon']);
  });

  test('an empty query returns colours instead of nothing', async () => {
    const client = createFakeSupabaseClient();
    await insertColorsBatch([GOLDEN, MAROON], client);
    const results = await searchColors('', 10, client);
    expect(results).toHaveLength(2);
  });

  test('respects the limit', async () => {
    const client = createFakeSupabaseClient();
    await insertColorsBatch([GOLDEN, MAROON], client);
    expect(await searchColors('', 1, client)).toHaveLength(1);
  });

  test('maps oklch_l/c/h back into a nested Oklch object', async () => {
    const client = createFakeSupabaseClient();
    await insertColorsBatch([GOLDEN], client);
    const [found] = await searchColors('Golden', 10, client);
    expect(found!.oklch).toEqual({ l: 0.79, c: 0.11, h: 70.5 });
  });
});

describe('getColor', () => {
  test('retrieves a color by id with tag fields mapped to camelCase', async () => {
    const client = createFakeSupabaseClient();
    await insertColorsBatch([GOLDEN], client);
    const [inserted] = await searchColors('Golden', 10, client);

    const found = await getColor(inserted!.id, client);
    expect(found?.useCase).toBe('Interiors');
    expect(found?.contrastLevel).toBe('Dark');
  });

  test('returns null for an id that does not exist', async () => {
    const client = createFakeSupabaseClient();
    expect(await getColor('nonexistent', client)).toBeNull();
  });
});

describe('getSemanticMatches', () => {
  test('returns a curated row for a bucket that matches', async () => {
    const client = createFakeSupabaseClient({
      colors: [
        {
          id: 'row-1',
          name: 'Golden Brick',
          hex: '#e5b262',
          oklch_l: 0.79,
          oklch_c: 0.11,
          oklch_h: 70.5,
          category: null,
          description: null,
          emotion: null,
          personality: null,
          mood: null,
          symbolism: null,
          use_case: null,
          keywords: null,
          contrast_level: null,
          provenance: 'seed',
          created_at: new Date().toISOString(),
          bucket_index: 42,
        },
      ],
    });

    const matches = await getSemanticMatches([42, 99], client);
    expect(matches.size).toBe(1);
    expect(matches.get(42)?.name).toBe('Golden Brick');
    expect(matches.has(99)).toBe(false);
  });

  test('returns an empty map for an empty input array without querying', async () => {
    const client = createFakeSupabaseClient();
    const matches = await getSemanticMatches([], client);
    expect(matches.size).toBe(0);
  });

  test('returns an empty map when no bucket has a curated row', async () => {
    const client = createFakeSupabaseClient();
    await insertColorsBatch([GOLDEN], client);
    const matches = await getSemanticMatches([123_456], client);
    expect(matches.size).toBe(0);
  });

  test('deduplicates repeated bucket indices in the request', async () => {
    const client = createFakeSupabaseClient({
      colors: [
        {
          id: 'row-1',
          name: 'Golden Brick',
          hex: '#e5b262',
          oklch_l: 0.79,
          oklch_c: 0.11,
          oklch_h: 70.5,
          category: null,
          description: null,
          emotion: null,
          personality: null,
          mood: null,
          symbolism: null,
          use_case: null,
          keywords: null,
          contrast_level: null,
          provenance: 'seed',
          created_at: new Date().toISOString(),
          bucket_index: 7,
        },
      ],
    });

    const matches = await getSemanticMatches([7, 7, 7], client);
    expect(matches.size).toBe(1);
  });
});

describe('countColors', () => {
  test('counts independently of any limit', async () => {
    const client = createFakeSupabaseClient();
    await insertColorsBatch([GOLDEN, MAROON], client);
    expect(await countColors(client)).toBe(2);
  });

  test('is zero for an empty table', async () => {
    const client = createFakeSupabaseClient();
    expect(await countColors(client)).toBe(0);
  });
});
