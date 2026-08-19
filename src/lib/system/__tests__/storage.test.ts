import { describe, expect, it } from 'vitest';
import { parseColor } from '@/lib/color-engine';
import { EMPTY_SYSTEM } from '../defaults';
import {
  deserializeSystem,
  migrateLegacyDock,
  resolveInitialSystem,
  serializeSystem,
} from '../storage';
import type { System } from '../types';

const VIOLET = '#5a3f73';
const GREEN = '#19d368';

const POPULATED: System = {
  ...EMPTY_SYSTEM,
  palette: [
    { hex: VIOLET, oklch: parseColor(VIOLET), addedAt: 0 },
    { hex: GREEN, oklch: parseColor(GREEN), addedAt: 1 },
  ],
  anchorHex: VIOLET,
};

/** A dock exactly as the shipped build writes it. */
function legacyDock(hexes: string[], anchor?: string): string {
  return JSON.stringify({
    items: hexes.map((hex, i) => ({ hex, oklch: parseColor(hex), addedAt: 1700000000000 + i })),
    primaryAnchorHex: anchor ?? hexes[0] ?? null,
  });
}

describe('serialize / deserialize', () => {
  it('round-trips through storage', () => {
    const back = deserializeSystem(serializeSystem(POPULATED));
    expect(back?.palette.map((c) => c.hex)).toEqual([VIOLET, GREEN]);
    expect(back?.anchorHex).toBe(VIOLET);
  });

  it('treats absent or blank storage as absent, not as an error', () => {
    expect(deserializeSystem(null)).toBeNull();
    expect(deserializeSystem('')).toBeNull();
    expect(deserializeSystem('  ')).toBeNull();
  });

  it('survives corrupt storage', () => {
    for (const junk of ['{{{', ' ', 'c=', 'not a system at all', '%%%']) {
      expect(() => deserializeSystem(junk)).not.toThrow();
    }
  });
});

describe('migrateLegacyDock', () => {
  it('carries a collected dock forward into a System', () => {
    const migrated = migrateLegacyDock(legacyDock([VIOLET, GREEN]));
    expect(migrated?.palette.map((c) => c.hex)).toEqual([VIOLET, GREEN]);
    expect(migrated?.anchorHex).toBe(VIOLET);
  });

  it('keeps the anchor the person had chosen', () => {
    expect(migrateLegacyDock(legacyDock([VIOLET, GREEN], GREEN))?.anchorHex).toBe(GREEN);
  });

  it('falls back to the first colour when the stored anchor is bogus', () => {
    expect(migrateLegacyDock(legacyDock([VIOLET, GREEN], '#ffffff'))?.anchorHex).toBe(VIOLET);
  });

  it('recomputes oklch instead of trusting what an older build wrote', () => {
    // A previous build stored hex and oklch as independent fields, and they
    // were free to drift apart. The hex is the thing a person actually picked.
    const lying = JSON.stringify({
      items: [{ hex: VIOLET, oklch: { l: 0.9, c: 0.3, h: 12 }, addedAt: 1 }],
      primaryAnchorHex: VIOLET,
    });
    expect(migrateLegacyDock(lying)?.palette[0]!.oklch).toEqual(parseColor(VIOLET));
  });

  it('skips malformed entries but keeps the rest', () => {
    const messy = JSON.stringify({
      items: [{ hex: VIOLET }, { hex: 'nope' }, null, 42, { hex: GREEN }],
      primaryAnchorHex: VIOLET,
    });
    expect(migrateLegacyDock(messy)?.palette.map((c) => c.hex)).toEqual([VIOLET, GREEN]);
  });

  it('returns null for an empty or unusable dock rather than an empty System', () => {
    expect(migrateLegacyDock(null)).toBeNull();
    expect(migrateLegacyDock('{{{')).toBeNull();
    expect(migrateLegacyDock(JSON.stringify({ items: [] }))).toBeNull();
    expect(migrateLegacyDock(JSON.stringify({ items: 'nope' }))).toBeNull();
    expect(migrateLegacyDock(JSON.stringify({}))).toBeNull();
  });

  it('never throws on hostile input', () => {
    for (const junk of ['[]', 'null', '"a string"', '{"items":[{"hex":123}]}', '0']) {
      expect(() => migrateLegacyDock(junk)).not.toThrow();
    }
  });
});

describe('resolveInitialSystem — precedence', () => {
  it('a link beats everything, because following it is the whole point', () => {
    const r = resolveInitialSystem({
      search: '?c=cfa15d',
      stored: serializeSystem(POPULATED),
      legacyDock: legacyDock([VIOLET]),
    });
    expect(r.source).toBe('url');
    expect(r.system.palette.map((c) => c.hex)).toEqual(['#cfa15d']);
  });

  it('a bare URL does not wipe what this browser already had', () => {
    // The absence of a request is not a request for emptiness.
    const r = resolveInitialSystem({
      search: '',
      stored: serializeSystem(POPULATED),
      legacyDock: null,
    });
    expect(r.source).toBe('storage');
    expect(r.system.palette).toHaveLength(2);
  });

  it('migrates the old dock when there is no System yet', () => {
    const r = resolveInitialSystem({ search: '', stored: null, legacyDock: legacyDock([GREEN]) });
    expect(r.source).toBe('legacy-dock');
    expect(r.system.palette.map((c) => c.hex)).toEqual([GREEN]);
  });

  it('prefers a real System over an old dock when both exist', () => {
    const r = resolveInitialSystem({
      search: '',
      stored: serializeSystem(POPULATED),
      legacyDock: legacyDock(['#cfa15d']),
    });
    expect(r.source).toBe('storage');
  });

  it('falls all the way through to the default', () => {
    const r = resolveInitialSystem({ search: '', stored: null, legacyDock: null });
    expect(r.source).toBe('default');
    expect(r.system).toEqual(EMPTY_SYSTEM);
  });

  it('ignores storage that decodes to nothing', () => {
    const r = resolveInitialSystem({ search: '', stored: '', legacyDock: legacyDock([GREEN]) });
    expect(r.source).toBe('legacy-dock');
  });

  it('never throws, whatever the three sources contain', () => {
    const values = ['', '?', 'c=zzz', '{{{', null];
    for (const search of values) {
      for (const stored of values) {
        for (const legacy of values) {
          expect(() =>
            resolveInitialSystem({ search: search ?? '', stored, legacyDock: legacy })
          ).not.toThrow();
        }
      }
    }
  });
});
