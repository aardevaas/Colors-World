import { describe, expect, it } from 'vitest';
import { parseColor } from '@/lib/color-engine';
import { EMPTY_SYSTEM } from '../defaults';
import { systemReducer } from '../system-reducer';
import type { System } from '../types';

const VIOLET = '#5a3f73';
const GREEN = '#19d368';
const TAN = '#cfa15d';

function add(state: System, hex: string, at = 0): System {
  return systemReducer(state, { type: 'addColor', hex, oklch: parseColor(hex), addedAt: at });
}

function threeColors(): System {
  return add(add(add(EMPTY_SYSTEM, VIOLET, 1), GREEN, 2), TAN, 3);
}

describe('systemReducer — palette', () => {
  it('makes the first colour the anchor automatically', () => {
    expect(add(EMPTY_SYSTEM, VIOLET).anchorHex).toBe(VIOLET);
  });

  it('never bumps an anchor that is already chosen', () => {
    expect(threeColors().anchorHex).toBe(VIOLET);
  });

  it('ignores a duplicate, whatever case it arrives in', () => {
    const once = add(EMPTY_SYSTEM, VIOLET);
    expect(add(once, '#5A3F73').palette).toHaveLength(1);
    expect(add(once, VIOLET)).toBe(once);
  });

  it('promotes the next colour when the anchor is removed', () => {
    const after = systemReducer(threeColors(), { type: 'removeColor', hex: VIOLET });
    expect(after.anchorHex).toBe(GREEN);
    expect(after.palette).toHaveLength(2);
  });

  it('leaves the anchor alone when some other colour is removed', () => {
    const after = systemReducer(threeColors(), { type: 'removeColor', hex: TAN });
    expect(after.anchorHex).toBe(VIOLET);
  });

  it('clears the anchor when the last colour goes', () => {
    const after = systemReducer(add(EMPTY_SYSTEM, VIOLET), { type: 'removeColor', hex: VIOLET });
    expect(after.anchorHex).toBeNull();
    expect(after.palette).toEqual([]);
  });

  it('is a no-op when removing something not in the palette', () => {
    const before = threeColors();
    expect(systemReducer(before, { type: 'removeColor', hex: '#ffffff' })).toBe(before);
  });

  it('refuses an anchor that is not in the palette', () => {
    const before = threeColors();
    expect(systemReducer(before, { type: 'setAnchor', hex: '#ffffff' })).toBe(before);
    expect(systemReducer(before, { type: 'setAnchor', hex: TAN }).anchorHex).toBe(TAN);
  });

  it('caps the palette so no route can grow it without bound', () => {
    let state = EMPTY_SYSTEM;
    for (let i = 0; i < 60; i++) state = add(state, '#' + i.toString(16).padStart(6, '0'), i);
    expect(state.palette.length).toBeLessThanOrEqual(32);
  });
});

describe('systemReducer — roles', () => {
  it('sets and clears an override', () => {
    const set = systemReducer(threeColors(), { type: 'setRoleOverride', role: 'primary', hex: TAN });
    expect(set.roleOverrides.primary).toBe(TAN);
    expect(systemReducer(set, { type: 'clearRoleOverride', role: 'primary' }).roleOverrides.primary)
      .toBeUndefined();
  });

  it('drops an override when its colour leaves the palette', () => {
    // Otherwise a role keeps painting a colour with no swatch to explain it.
    const pinned = systemReducer(threeColors(), { type: 'setRoleOverride', role: 'primary', hex: TAN });
    const after = systemReducer(pinned, { type: 'removeColor', hex: TAN });
    expect(after.roleOverrides.primary).toBeUndefined();
  });

  it('keeps unrelated overrides when a colour leaves', () => {
    let state = systemReducer(threeColors(), { type: 'setRoleOverride', role: 'primary', hex: TAN });
    state = systemReducer(state, { type: 'setRoleOverride', role: 'text', hex: GREEN });
    const after = systemReducer(state, { type: 'removeColor', hex: TAN });
    expect(after.roleOverrides.text).toBe(GREEN);
  });

  it('clearing the palette clears the pins with it', () => {
    const pinned = systemReducer(threeColors(), { type: 'setRoleOverride', role: 'primary', hex: TAN });
    const after = systemReducer(pinned, { type: 'clearPalette' });
    expect(after.roleOverrides).toEqual({});
    expect(after.anchorHex).toBeNull();
  });

  it('leaves type and mode untouched when the palette is cleared', () => {
    let state = systemReducer(threeColors(), { type: 'setMode', mode: 'light' });
    state = systemReducer(state, { type: 'setType', patch: { weight: 700 } });
    const after = systemReducer(state, { type: 'clearPalette' });
    expect(after.mode).toBe('light');
    expect(after.type.weight).toBe(700);
  });
});

describe('systemReducer — type and mode', () => {
  it('patches type without disturbing the other fields', () => {
    const after = systemReducer(EMPTY_SYSTEM, { type: 'setType', patch: { weight: 600 } });
    expect(after.type.weight).toBe(600);
    expect(after.type.ratio).toBe(EMPTY_SYSTEM.type.ratio);
  });

  it('returns the same object when the mode does not change', () => {
    expect(systemReducer(EMPTY_SYSTEM, { type: 'setMode', mode: 'dark' })).toBe(EMPTY_SYSTEM);
  });

  it('hydrates wholesale', () => {
    const other: System = { ...EMPTY_SYSTEM, mode: 'light' };
    expect(systemReducer(EMPTY_SYSTEM, { type: 'hydrate', system: other })).toBe(other);
  });
});

describe('systemReducer — setPalette', () => {
  const generated = [VIOLET, GREEN, TAN].map((hex) => ({ hex, oklch: parseColor(hex) }));

  it('replaces the palette wholesale and anchors on the first colour', () => {
    const after = systemReducer(EMPTY_SYSTEM, { type: 'setPalette', colors: generated });
    expect(after.palette.map((c) => c.hex)).toEqual([VIOLET, GREEN, TAN]);
    expect(after.anchorHex).toBe(VIOLET);
  });

  it('drops role pins, which referred to the palette being replaced', () => {
    // Keeping them would paint a freshly generated system with colours that
    // are no longer in it and have no swatch to explain where they came from.
    const pinned = systemReducer(threeColors(), { type: 'setRoleOverride', role: 'primary', hex: TAN });
    const after = systemReducer(pinned, { type: 'setPalette', colors: [{ hex: '#ffffff', oklch: parseColor('#ffffff') }] });
    expect(after.roleOverrides).toEqual({});
  });

  it('keeps type and mode, which are not the palette', () => {
    let state = systemReducer(EMPTY_SYSTEM, { type: 'setMode', mode: 'light' });
    state = systemReducer(state, { type: 'setType', patch: { weight: 700 } });
    const after = systemReducer(state, { type: 'setPalette', colors: generated });
    expect(after.mode).toBe('light');
    expect(after.type.weight).toBe(700);
  });

  it('dedupes and caps whatever it is handed', () => {
    const dupes = [...generated, ...generated, { hex: '#5A3F73', oklch: parseColor(VIOLET) }];
    expect(systemReducer(EMPTY_SYSTEM, { type: 'setPalette', colors: dupes }).palette).toHaveLength(3);

    const huge = Array.from({ length: 90 }, (_, i) => {
      const hex = '#' + i.toString(16).padStart(6, '0');
      return { hex, oklch: parseColor(hex) };
    });
    expect(
      systemReducer(EMPTY_SYSTEM, { type: 'setPalette', colors: huge }).palette.length
    ).toBeLessThanOrEqual(32);
  });

  it('handles an empty generation without leaving a dangling anchor', () => {
    const after = systemReducer(threeColors(), { type: 'setPalette', colors: [] });
    expect(after.palette).toEqual([]);
    expect(after.anchorHex).toBeNull();
  });
});

describe('systemReducer — immutability', () => {
  it('never mutates the state it was given', () => {
    const before = threeColors();
    const snapshot = JSON.stringify(before);
    systemReducer(before, { type: 'removeColor', hex: VIOLET });
    systemReducer(before, { type: 'setRoleOverride', role: 'primary', hex: TAN });
    systemReducer(before, { type: 'setType', patch: { weight: 900 } });
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});
