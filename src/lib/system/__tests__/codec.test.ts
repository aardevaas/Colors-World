import { describe, expect, it, test } from 'vitest';
import { parseColor } from '@/lib/color-engine';
import { SEMANTIC_ROLES } from '@/lib/roles/semantic-roles';
import { DEFAULT_SCALES, EMPTY_SYSTEM } from '../defaults';
import { decodeSystem, encodeSystem, isDefaultSystem } from '../codec';
import type { System, SystemColor } from '../types';

function color(hex: string, addedAt = 0): SystemColor {
  return { hex, oklch: parseColor(hex), addedAt };
}

/** The three colors used throughout the audit, in collection order. */
const PALETTE = [color('#5A3F73', 1), color('#19D368', 2), color('#CFA15D', 3)];

const FULL: System = {
  palette: PALETTE,
  anchorHex: '#19D368',
  roleOverrides: { primary: '#CFA15D', text: '#FFFFFF' },
  type: { presetId: 'editorial', ratio: 1.333, baseRem: 1.125, lineHeight: 1.7, tracking: 0.02, weight: 500 },
  scales: DEFAULT_SCALES,
  mode: 'light',
  proportions: {},
};

/** The curve work: what a shared link used to drop on the floor. */
const WITH_SCALES: System = {
  ...FULL,
  scales: {
    steps: 8,
    gamut: 'p3',
    byHex: {
      '#5a3f73': {
        name: 'brand',
        chromaIntensity: 1.2,
        hueTorsion: 15,
        lightnessCurve: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0.42 },
          { x: 1, y: 1 },
        ],
      },
      '#cfa15d': { hueTorsion: -30 },
    },
  },
};

describe('encodeSystem / decodeSystem', () => {
  it('round-trips a fully-populated System', () => {
    const back = decodeSystem(encodeSystem(FULL));
    expect(back.palette.map((c) => c.hex.toLowerCase())).toEqual(
      FULL.palette.map((c) => c.hex.toLowerCase())
    );
    expect(back.anchorHex?.toLowerCase()).toBe('#19d368');
    expect(back.mode).toBe('light');
    expect(back.type).toEqual(FULL.type);
  });

  it('round-trips role overrides', () => {
    const back = decodeSystem(encodeSystem(FULL));
    expect(back.roleOverrides.primary?.toLowerCase()).toBe('#cfa15d');
    expect(back.roleOverrides.text?.toLowerCase()).toBe('#ffffff');
    expect(back.roleOverrides.background).toBeUndefined();
  });

  it('rebuilds oklch from the hex rather than carrying it in the URL', () => {
    // The URL must stay short and human-readable; oklch is derivable.
    const back = decodeSystem(encodeSystem(FULL));
    expect(back.palette[0]!.oklch).toEqual(parseColor('#5A3F73'));
  });

  it('preserves palette order, because the strip is laid out in it', () => {
    const back = decodeSystem(encodeSystem(FULL));
    expect(back.palette.map((c) => c.hex.toLowerCase())).toEqual(['#5a3f73', '#19d368', '#cfa15d']);
  });

  it('emits nothing at all for a default System', () => {
    // A first-time visitor should see a clean URL, not a query string
    // restating every default back at them.
    expect(encodeSystem(EMPTY_SYSTEM)).toBe('');
    expect(isDefaultSystem(EMPTY_SYSTEM)).toBe(true);
  });

  it('omits sections that are still at their defaults', () => {
    const onlyColors: System = { ...EMPTY_SYSTEM, palette: PALETTE, anchorHex: '#5A3F73' };
    const encoded = encodeSystem(onlyColors);
    expect(encoded).toContain('c=');
    expect(encoded).not.toContain('t=');
    expect(encoded).not.toContain('m=');
    expect(encoded).not.toContain('r=');
  });

  it('produces a URL a person can read and hand-edit', () => {
    const encoded = encodeSystem({ ...EMPTY_SYSTEM, palette: PALETTE, anchorHex: '#5A3F73' });
    expect(encoded).toBe('c=5a3f73-19d368-cfa15d');
  });
});

describe('decodeSystem — hostile and hand-edited input', () => {
  it('returns the default System for an empty query', () => {
    expect(decodeSystem('')).toEqual(EMPTY_SYSTEM);
  });

  it('never throws, whatever it is handed', () => {
    const nasty = [
      '?????', 'c=', 'c=zzzzzz', 'c=5a3f73-nothex-19d368', 'c=' + 'a'.repeat(5000),
      'r=notarole.ffffff', 'r=primary', 'r=primary.', 't=', 't=~~~~~', 't=nope~x~y~z~w~v',
      'm=sideways', 'a=ffffff', '%%%', 'c=%E0%A4%A', 'c=5a3f73&c=19d368',
    ];
    for (const input of nasty) {
      expect(() => decodeSystem(input)).not.toThrow();
      expect(SEMANTIC_ROLES.every((r) => typeof decodeSystem(input).roleOverrides[r] !== 'object')).toBe(true);
    }
  });

  it('drops malformed colors but keeps the good ones', () => {
    const back = decodeSystem('c=5a3f73-nothex-19d368');
    expect(back.palette.map((c) => c.hex.toLowerCase())).toEqual(['#5a3f73', '#19d368']);
  });

  it('accepts hex with or without a leading hash, in any case', () => {
    const back = decodeSystem('c=5A3F73-%2319d368');
    expect(back.palette.map((c) => c.hex.toLowerCase())).toEqual(['#5a3f73', '#19d368']);
  });

  it('ignores an anchor that is not in the palette', () => {
    // Otherwise the scale builder points at a color nobody can see.
    expect(decodeSystem('c=5a3f73&a=ffffff').anchorHex).toBe('#5a3f73');
  });

  it('falls back to the first color when no anchor is given', () => {
    expect(decodeSystem('c=5a3f73-19d368').anchorHex).toBe('#5a3f73');
  });

  it('drops role overrides that name a role that does not exist', () => {
    const back = decodeSystem('r=primary.19d368,bogus.ffffff');
    expect(back.roleOverrides.primary?.toLowerCase()).toBe('#19d368');
    expect(Object.keys(back.roleOverrides)).toEqual(['primary']);
  });

  it('clamps out-of-range type values instead of rendering something impossible', () => {
    const back = decodeSystem('t=neo-tech~99~99~99~99~9999');
    expect(back.type.ratio).toBeLessThanOrEqual(3);
    expect(back.type.weight).toBeLessThanOrEqual(900);
    expect(back.type.baseRem).toBeLessThanOrEqual(4);
    expect(Number.isFinite(back.type.lineHeight)).toBe(true);
  });

  it('rejects a type preset that is not one we ship', () => {
    expect(decodeSystem('t=malicious~1.25~1~1.55~0~400').type.presetId).toBe(EMPTY_SYSTEM.type.presetId);
  });

  it('treats an unknown mode as the default', () => {
    expect(decodeSystem('m=sideways').mode).toBe('dark');
    expect(decodeSystem('m=light').mode).toBe('light');
  });

  it('caps the palette so a hand-edited URL cannot hang the app', () => {
    const huge = Array.from({ length: 500 }, (_, i) => i.toString(16).padStart(6, '0')).join('-');
    expect(decodeSystem('c=' + huge).palette.length).toBeLessThanOrEqual(32);
  });

  it('tolerates a leading question mark', () => {
    expect(decodeSystem('?c=5a3f73').palette).toHaveLength(1);
  });
});

describe('encodeSystem / decodeSystem — the scales', () => {
  it('round-trips curves, intensity, torsion and names', () => {
    const back = decodeSystem(encodeSystem(WITH_SCALES));
    const violet = back.scales.byHex['#5a3f73']!;
    expect(violet.name).toBe('brand');
    expect(violet.chromaIntensity).toBe(1.2);
    expect(violet.hueTorsion).toBe(15);
    expect(violet.lightnessCurve).toEqual([
      { x: 0, y: 0 },
      { x: 0.5, y: 0.42 },
      { x: 1, y: 1 },
    ]);
    expect(back.scales.byHex['#cfa15d']!.hueTorsion).toBe(-30);
  });

  it('round-trips step count and gamut', () => {
    const back = decodeSystem(encodeSystem(WITH_SCALES));
    expect(back.scales.steps).toBe(8);
    expect(back.scales.gamut).toBe('p3');
  });

  it('costs nothing when no scale has been touched', () => {
    // A palette of six colors nobody has customised must not lengthen the
    // URL by a single character.
    const encoded = encodeSystem(FULL);
    expect(encoded).not.toContain('s=');
    expect(encoded).not.toContain('sg=');
  });

  it('writes only the scales that differ from default', () => {
    const one: System = {
      ...FULL,
      scales: { ...DEFAULT_SCALES, byHex: { '#19d368': { hueTorsion: 12 } } },
    };
    // Index 1 in the palette, and nothing about the other two.
    expect(encodeSystem(one)).toContain('s=1~t:12');
  });

  it('drops a settings object that carries only defaults', () => {
    const noop: System = {
      ...FULL,
      scales: { ...DEFAULT_SCALES, byHex: { '#5a3f73': { chromaIntensity: 1, hueTorsion: 0 } } },
    };
    expect(encodeSystem(noop)).not.toContain('s=');
  });

  it('keeps settings attached to their color when the palette is reordered', () => {
    // The reason the model keys by hex even though the URL writes indices.
    const reordered: System = {
      ...WITH_SCALES,
      palette: [...WITH_SCALES.palette].reverse(),
    };
    const back = decodeSystem(encodeSystem(reordered));
    expect(back.scales.byHex['#5a3f73']!.name).toBe('brand');
    expect(back.scales.byHex['#cfa15d']!.hueTorsion).toBe(-30);
  });

  it('survives a double round-trip unchanged', () => {
    const once = encodeSystem(WITH_SCALES);
    expect(encodeSystem(decodeSystem(once))).toBe(once);
  });

  it('keeps a name with grammar characters in it intact', () => {
    const awkward: System = {
      ...FULL,
      scales: { ...DEFAULT_SCALES, byHex: { '#5a3f73': { name: 'a~b,c:d e' } } },
    };
    expect(decodeSystem(encodeSystem(awkward)).scales.byHex['#5a3f73']!.name).toBe('a~b,c:d e');
  });
});

describe('decodeSystem — hostile scale input', () => {
  it('never throws on malformed scale data', () => {
    const nasty = [
      's=', 's=~~~', 's=99~n:x', 's=-1~t:5', 's=0', 's=abc~c:1.5',
      's=0~l:', 's=0~l:0_0', 's=0~l:1_1|0_0', 's=0~l:a_b|c_d',
      's=0~n:%', 'sg=', 'sg=~', 'sg=99~fake', 's=0~' + 'x:1~'.repeat(500),
      's=0~l:' + Array.from({length: 400}, (_, i) => `${i / 400}_0.5`).join('|'),
    ];
    for (const input of nasty) {
      expect(() => decodeSystem('c=5a3f73-19d368&' + input)).not.toThrow();
    }
  });

  it('rejects a curve whose x values are not ascending and distinct', () => {
    // The interpolator throws on those, so taking one on trust would crash a
    // render rather than show a wrong shape.
    expect(decodeSystem('c=5a3f73&s=0~l:1_1|0_0').scales.byHex['#5a3f73']).toBeUndefined();
    expect(decodeSystem('c=5a3f73&s=0~l:0.5_1|0.5_0').scales.byHex['#5a3f73']).toBeUndefined();
  });

  it('rejects a curve of fewer than two points rather than half-drawing it', () => {
    expect(decodeSystem('c=5a3f73&s=0~l:0_0').scales.byHex['#5a3f73']).toBeUndefined();
  });

  it('caps curve length so a hand-edited URL cannot hang a render', () => {
    const huge = Array.from({ length: 400 }, (_, i) => `${i / 400}_0.5`).join('|');
    expect(decodeSystem(`c=5a3f73&s=0~l:${huge}`).scales.byHex['#5a3f73']).toBeUndefined();
  });

  it('ignores a scale pointing past the end of the palette', () => {
    expect(decodeSystem('c=5a3f73&s=9~t:12').scales.byHex).toEqual({});
  });

  it('clamps out-of-range scale values', () => {
    const back = decodeSystem('c=5a3f73&sg=99~srgb&s=0~c:99~t:9999');
    expect(back.scales.steps).toBeLessThanOrEqual(10);
    expect(back.scales.byHex['#5a3f73']!.chromaIntensity).toBeLessThanOrEqual(2);
    expect(Math.abs(back.scales.byHex['#5a3f73']!.hueTorsion!)).toBeLessThanOrEqual(180);
  });

  it('falls back to a real gamut for an invented one', () => {
    expect(decodeSystem('sg=8~fake').scales.gamut).toBe('srgb');
  });

  it('caps a very long scale name', () => {
    const long = 'x'.repeat(400);
    const name = decodeSystem(`c=5a3f73&s=0~n:${long}`).scales.byHex['#5a3f73']!.name!;
    expect(name.length).toBeLessThanOrEqual(24);
  });
});

describe('encodeSystem — stability', () => {
  it('is deterministic', () => {
    expect(encodeSystem(FULL)).toBe(encodeSystem(FULL));
  });

  it('survives a double round-trip unchanged', () => {
    const once = encodeSystem(FULL);
    expect(encodeSystem(decodeSystem(once))).toBe(once);
  });

  it('does not leak the locally-scanned font family into a shared link', () => {
    // A face installed here is not installed on the recipient's machine.
    expect(encodeSystem(FULL)).not.toMatch(/local|family/i);
  });
});

describe('font families in the URL', () => {
  /*
   * Added 2026-08-24 when the catalogue went from four presets to 2,096
   * families. Families ride in their own `f` parameter rather than as trailing
   * fields on `t`, so a System that never left its preset carries no cost for
   * them at all.
   */
  const withFamilies = (families: NonNullable<System['type']['families']>): System => ({
    ...EMPTY_SYSTEM,
    type: { ...EMPTY_SYSTEM.type, families },
  });

  it('costs nothing when nothing is overridden', () => {
    expect(encodeSystem(EMPTY_SYSTEM)).not.toContain('f=');
  });

  it('round-trips a full set', () => {
    const system = withFamilies({ display: 'unbounded', body: 'inter', mono: 'geist-mono' });
    expect(decodeSystem(encodeSystem(system)).type.families).toEqual({
      display: 'unbounded',
      body: 'inter',
      mono: 'geist-mono',
    });
  });

  it('round-trips a partial set, leaving the others on the preset', () => {
    const system = withFamilies({ body: 'inter' });
    const back = decodeSystem(encodeSystem(system)).type.families;
    expect(back).toEqual({ body: 'inter' });
    expect(back?.display).toBeUndefined();
  });

  it('encodes a body-only override without trailing separators', () => {
    expect(encodeSystem(withFamilies({ display: 'unbounded' }))).toContain('f=unbounded');
  });

  it('rejects a slug that is not slug-shaped, rather than rendering nothing', () => {
    /*
     * Shape, not membership: validating against the 385KB catalogue would ship
     * two thousand families to the browser to check three. A slug that passes
     * shape and matches nothing simply does not load, and the family's declared
     * fallback stack takes over — which is what a fallback is for.
     */
    expect(decodeSystem('?f=Not%20A%20Slug~inter').type.families).toEqual({ body: 'inter' });
    expect(decodeSystem('?f=<script>~~').type.families).toBeUndefined();
  });

  it('drops the key entirely when every segment is junk', () => {
    expect(decodeSystem('?f=~~').type.families).toBeUndefined();
  });

  it('survives a System on default metrics but a chosen face', () => {
    // The regression this guards: `isDefaultType` omits `t=` for default
    // metrics, and families must not be omitted with it.
    const system = withFamilies({ body: 'inter' });
    const encoded = encodeSystem(system);
    expect(encoded).not.toContain('t=');
    expect(encoded).toContain('f=');
    expect(decodeSystem(encoded).type.families).toEqual({ body: 'inter' });
  });
});

describe('proportions', () => {
  const withTarget = (proportions: System['proportions']): System => ({
    ...EMPTY_SYSTEM,
    proportions,
  });

  test('a System with no stated ratio adds nothing to the URL', () => {
    expect(encodeSystem(EMPTY_SYSTEM)).not.toContain('pp=');
    expect(isDefaultSystem(EMPTY_SYSTEM)).toBe(true);
  });

  test('a floor round-trips as a readable percentage', () => {
    const system = withTarget({ primary: { min: 0.25 } });
    expect(encodeSystem(system)).toContain('pp=primary.25');
    expect(decodeSystem(encodeSystem(system)).proportions).toEqual({ primary: { min: 0.25 } });
  });

  test('a band round-trips, and so do several roles at once', () => {
    const system = withTarget({ primary: { min: 0.25, max: 0.5 }, accent: { min: 0.05, max: 0.15 } });
    const encoded = encodeSystem(system);
    expect(encoded).toContain('primary.25-50');
    expect(encoded).toContain('accent.5-15');
    expect(decodeSystem(encoded).proportions).toEqual(system.proportions);
  });

  test('keeps one decimal, which is the precision the book prints', () => {
    const system = withTarget({ accent: { min: 0.055 } });
    expect(encodeSystem(system)).toContain('pp=accent.5.5');
    expect(decodeSystem(encodeSystem(system)).proportions).toEqual({ accent: { min: 0.055 } });
  });

  test('roles come out in the System’s own order, not the order they were typed', () => {
    const a = encodeSystem(withTarget({ accent: { min: 0.1 }, primary: { min: 0.2 } }));
    const b = encodeSystem(withTarget({ primary: { min: 0.2 }, accent: { min: 0.1 } }));
    expect(a).toBe(b);
  });

  test('a hand-edited URL cannot state something impossible', () => {
    const bad = [
      'pp=notarole.25',      // not a semantic role
      'pp=primary.abc',      // not a number
      'pp=primary.-5',       // negative
      'pp=primary.101',      // over 100%
      'pp=primary.50-25',    // ceiling under its own floor
      'pp=primary.1-2-3',    // three bounds
      'pp=primary.',         // no value
      'pp=primary',          // no separator
      'pp=',
    ];
    for (const raw of bad) {
      expect(decodeSystem(raw).proportions, raw).toEqual({});
    }
  });

  test('one bad segment does not discard the good ones beside it', () => {
    expect(decodeSystem('pp=primary.25,notarole.9,accent.5').proportions).toEqual({
      primary: { min: 0.25 },
      accent: { min: 0.05 },
    });
  });

  test('0% is a real floor and is not confused with absent', () => {
    expect(decodeSystem('pp=primary.0').proportions).toEqual({ primary: { min: 0 } });
  });

  test('travels with the rest of the System', () => {
    const system: System = {
      ...EMPTY_SYSTEM,
      palette: [{ hex: '#0a5cff', oklch: parseColor('#0a5cff'), addedAt: 0 }],
      anchorHex: '#0a5cff',
      mode: 'light',
      proportions: { primary: { min: 0.25 } },
    };
    const back = decodeSystem(encodeSystem(system));
    expect(back.proportions).toEqual(system.proportions);
    expect(back.palette[0]?.hex).toBe('#0a5cff');
    expect(back.mode).toBe('light');
  });
});
