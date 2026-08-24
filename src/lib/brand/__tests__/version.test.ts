import { describe, expect, test } from 'vitest';
import { parseColor } from '@/lib/color-engine';
import { EMPTY_SYSTEM } from '@/lib/system/defaults';
import { decodeSystem, encodeSystem } from '@/lib/system/codec';
import type { System } from '@/lib/system/types';
import { systemVersion } from '../version';

const systemWith = (hexes: readonly string[], patch: Partial<System> = {}): System => ({
  ...EMPTY_SYSTEM,
  palette: hexes.map((hex, i) => ({ hex, oklch: parseColor(hex), addedAt: i })),
  anchorHex: hexes[0] ?? null,
  ...patch,
});

const BASE = ['#0a5cff', '#ff6b35', '#1b1b1f'];

describe('systemVersion', () => {
  test('an unconfigured System has no version to state', () => {
    const v = systemVersion(EMPTY_SYSTEM);
    expect(v.isEmpty).toBe(true);
    expect(v.id).toBe('');
  });

  test('a configured System gets a short readable stamp', () => {
    const v = systemVersion(systemWith(BASE));
    expect(v.isEmpty).toBe(false);
    expect(v.id).toMatch(/^[0-9a-z]{6,10}$/);
  });

  test('the same System always stamps the same', () => {
    expect(systemVersion(systemWith(BASE)).id).toBe(systemVersion(systemWith(BASE)).id);
  });

  test('SURVIVES A ROUND TRIP THROUGH THE URL', () => {
    // The stamp is printed on a document someone may re-open from a link. If
    // encoding and decoding moved it, two copies of the same guideline would
    // claim to be different versions — which is worse than having no stamp.
    const system = systemWith(BASE, { mode: 'light' });
    const reopened = decodeSystem(encodeSystem(system));
    expect(systemVersion(reopened).id).toBe(systemVersion(system).id);
  });

  test('ignores the case a colour was written in', () => {
    const lower = systemWith(['#0a5cff', '#ff6b35']);
    const upper = systemWith(['#0A5CFF', '#FF6B35']);
    expect(systemVersion(upper).id).toBe(systemVersion(lower).id);
  });

  test.each([
    ['a different colour', systemWith(['#0a5cff', '#ff6b35', '#1b1b20'])],
    ['an extra colour', systemWith([...BASE, '#00a67e'])],
    ['a colour removed', systemWith(BASE.slice(0, 2))],
    ['a different order', systemWith([BASE[1]!, BASE[0]!, BASE[2]!])],
    ['light instead of dark', systemWith(BASE, { mode: 'light' })],
    ['a role override', systemWith(BASE, { roleOverrides: { primary: '#00a67e' } })],
    ['a stated ratio', systemWith(BASE, { proportions: { primary: { min: 0.25 } } })],
    ['a different typeface', systemWith(BASE, {
      type: { ...EMPTY_SYSTEM.type, families: { body: 'source-serif-4' } },
    })],
    ['a different scale ratio', systemWith(BASE, {
      type: { ...EMPTY_SYSTEM.type, ratio: 1.333 },
    })],
  ])('changes when %s changes', (_label, changed) => {
    expect(systemVersion(changed).id).not.toBe(systemVersion(systemWith(BASE)).id);
  });

  /*
   * THE ONE TEST THAT MATTERS MOST, and it is not a property test.
   *
   * Every other test here passes for ANY well-behaved hash: change the
   * algorithm and stability, round-tripping and discrimination all still hold.
   * But a stamp already printed on a PDF, quoted in an email, or read down a
   * phone has to keep meaning the same thing — so the values themselves are
   * the contract, not the properties.
   *
   * If this fails, the hash changed and every guideline in existence has been
   * silently restamped. That is a breaking change, not a refactor.
   */
  test.each([
    ['c=0a5cff-ff6b35-1b1b1f', 'e66pnv09'],
    ['c=0a5cff', '1f3rbxa1'],
    ['m=light', 'mt57yx1q'],
    ['c=0a5cff-ff6b35-1b1b1f&m=light', 'oafqdv0b'],
  ])('stamps %s as %s, permanently', (query, expected) => {
    expect(systemVersion(decodeSystem(query)).id).toBe(expected);
  });

  test('says what the stamp actually covers', () => {
    const v = systemVersion(systemWith(BASE));
    expect(v.covers).toBeTruthy();
    expect(v.covers.toLowerCase()).toContain('colour');
  });

  test('distinct across many nearby systems — the stamp has to discriminate', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const hex = `#${i.toString(16).padStart(6, '0')}`;
      ids.add(systemVersion(systemWith([hex])).id);
    }
    expect(ids.size).toBe(400);
  });
});
