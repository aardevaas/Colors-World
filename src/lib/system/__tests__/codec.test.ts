import { describe, expect, it } from 'vitest';
import { parseColor } from '@/lib/color-engine';
import { SEMANTIC_ROLES } from '@/lib/roles/semantic-roles';
import { EMPTY_SYSTEM } from '../defaults';
import { decodeSystem, encodeSystem, isDefaultSystem } from '../codec';
import type { System, SystemColor } from '../types';

function color(hex: string, addedAt = 0): SystemColor {
  return { hex, oklch: parseColor(hex), addedAt };
}

/** The three colours used throughout the audit, in collection order. */
const PALETTE = [color('#5A3F73', 1), color('#19D368', 2), color('#CFA15D', 3)];

const FULL: System = {
  palette: PALETTE,
  anchorHex: '#19D368',
  roleOverrides: { primary: '#CFA15D', text: '#FFFFFF' },
  type: { presetId: 'editorial', ratio: 1.333, baseRem: 1.125, lineHeight: 1.7, tracking: 0.02, weight: 500 },
  mode: 'light',
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
    const onlyColours: System = { ...EMPTY_SYSTEM, palette: PALETTE, anchorHex: '#5A3F73' };
    const encoded = encodeSystem(onlyColours);
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

  it('drops malformed colours but keeps the good ones', () => {
    const back = decodeSystem('c=5a3f73-nothex-19d368');
    expect(back.palette.map((c) => c.hex.toLowerCase())).toEqual(['#5a3f73', '#19d368']);
  });

  it('accepts hex with or without a leading hash, in any case', () => {
    const back = decodeSystem('c=5A3F73-%2319d368');
    expect(back.palette.map((c) => c.hex.toLowerCase())).toEqual(['#5a3f73', '#19d368']);
  });

  it('ignores an anchor that is not in the palette', () => {
    // Otherwise the scale builder points at a colour nobody can see.
    expect(decodeSystem('c=5a3f73&a=ffffff').anchorHex).toBe('#5a3f73');
  });

  it('falls back to the first colour when no anchor is given', () => {
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
