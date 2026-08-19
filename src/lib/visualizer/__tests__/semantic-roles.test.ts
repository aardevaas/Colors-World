import { describe, expect, it } from 'vitest';
import { parseColor } from '@/lib/color-engine';
import {
  SEMANTIC_ROLES,
  deriveRoles,
  flipPolarity,
  rolesToCssVars,
  type RoleColor,
} from '../semantic-roles';

function color(hex: string): RoleColor {
  return { hex, oklch: parseColor(hex) };
}

/** A realistic six-colour brand palette, deliberately shuffled. */
const PALETTE: RoleColor[] = [
  color('#7C5CFF'), // vivid violet — should read as primary
  color('#0B0B0C'), // near-black — darkest
  color('#F2F2F5'), // near-white — lightest
  color('#FFB454'), // vivid amber — second most chromatic
  color('#17171A'), // dark grey
  color('#2A2A30'), // slightly lighter grey
];

describe('deriveRoles', () => {
  it('always returns every semantic role', () => {
    const roles = deriveRoles(PALETTE);
    for (const role of SEMANTIC_ROLES) {
      expect(roles[role]).toBeDefined();
      expect(roles[role].hex).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('puts the darkest colour on background and the lightest on text', () => {
    const roles = deriveRoles(PALETTE);
    expect(roles.background.hex).toBe('#0B0B0C');
    expect(roles.text.hex).toBe('#F2F2F5');
  });

  it('picks the most chromatic mid-tone as primary, not the most saturated overall', () => {
    const roles = deriveRoles(PALETTE);
    expect(roles.primary.hex).toBe('#7C5CFF');
    expect(roles.accent.hex).toBe('#FFB454');
  });

  it('is order-independent — shuffling the input cannot change the mapping', () => {
    const shuffled = [...PALETTE].reverse();
    expect(deriveRoles(shuffled)).toEqual(deriveRoles(PALETTE));
  });

  it('produces a readable text/background pair', () => {
    const roles = deriveRoles(PALETTE);
    // The whole point of lightness-ordering: these two must be far apart.
    expect(Math.abs(roles.text.oklch.l - roles.background.oklch.l)).toBeGreaterThan(0.5);
  });
});

describe('deriveRoles — degenerate palettes', () => {
  it('returns a complete usable set for an empty palette', () => {
    const roles = deriveRoles([]);
    for (const role of SEMANTIC_ROLES) expect(roles[role]).toBeDefined();
  });

  it('never uses a single colour as both background and text', () => {
    const roles = deriveRoles([color('#7C5CFF')]);
    expect(roles.background.hex).not.toBe(roles.text.hex);
    // The one supplied colour should still be the brand.
    expect(roles.primary.hex).toBe('#7C5CFF');
  });

  it('keeps background and text distinct even when every colour is the same lightness', () => {
    const flat = [color('#FF0000'), color('#00FF00'), color('#0000FF')];
    const roles = deriveRoles(flat);
    expect(roles.background.hex).not.toBe(roles.text.hex);
  });

  it('handles a two-colour palette without leaving a role empty', () => {
    const roles = deriveRoles([color('#000000'), color('#FFFFFF')]);
    expect(roles.background.hex).toBe('#000000');
    expect(roles.text.hex).toBe('#FFFFFF');
    for (const role of SEMANTIC_ROLES) expect(roles[role].hex).toBeTruthy();
  });
});

describe('deriveRoles — manual overrides', () => {
  it('lets a manual choice win over the derived mapping', () => {
    const roles = deriveRoles(PALETTE, { primary: color('#19D368') });
    expect(roles.primary.hex).toBe('#19D368');
    // Everything else still derived.
    expect(roles.background.hex).toBe('#0B0B0C');
  });

  it('ignores explicitly-undefined overrides rather than blanking the role', () => {
    const roles = deriveRoles(PALETTE, { primary: undefined });
    expect(roles.primary.hex).toBe('#7C5CFF');
  });

  it('can override every role at once', () => {
    const all = Object.fromEntries(SEMANTIC_ROLES.map((r) => [r, color('#123456')]));
    const roles = deriveRoles(PALETTE, all);
    for (const role of SEMANTIC_ROLES) expect(roles[role].hex).toBe('#123456');
  });
});

describe('rolesToCssVars', () => {
  it('emits one custom property per role', () => {
    const vars = rolesToCssVars(deriveRoles(PALETTE));
    expect(Object.keys(vars)).toHaveLength(SEMANTIC_ROLES.length);
    expect(vars['--ui-background']).toBe('#0B0B0C');
    expect(vars['--ui-primary']).toBe('#7C5CFF');
  });
});

describe('flipPolarity', () => {
  it('inverts background and text lightness', () => {
    const roles = deriveRoles(PALETTE);
    const flipped = flipPolarity(roles);
    expect(flipped.background.oklch.l).toBeCloseTo(1 - roles.background.oklch.l, 6);
    expect(flipped.text.oklch.l).toBeCloseTo(1 - roles.text.oklch.l, 6);
  });

  it('recomputes hex, not just the oklch field', () => {
    // Regression guard: mirroring `oklch` while carrying `hex` over unchanged
    // makes the flip a silent no-op, since rolesToCssVars emits hex.
    const roles = deriveRoles(PALETTE);
    const flipped = flipPolarity(roles);
    expect(flipped.background.hex).not.toBe(roles.background.hex);
    expect(flipped.text.hex).not.toBe(roles.text.hex);
    expect(rolesToCssVars(flipped)['--ui-background']).not.toBe(
      rolesToCssVars(roles)['--ui-background']
    );
  });

  it('leaves the brand colours untouched — the hue must survive the flip', () => {
    const roles = deriveRoles(PALETTE);
    const flipped = flipPolarity(roles);
    expect(flipped.primary).toEqual(roles.primary);
    expect(flipped.accent).toEqual(roles.accent);
  });

  it('still separates text from background after flipping', () => {
    const flipped = flipPolarity(deriveRoles(PALETTE));
    expect(Math.abs(flipped.text.oklch.l - flipped.background.oklch.l)).toBeGreaterThan(0.5);
  });

  it('round-trips back to the original lightness when applied twice', () => {
    const roles = deriveRoles(PALETTE);
    const twice = flipPolarity(flipPolarity(roles));
    expect(twice.background.oklch.l).toBeCloseTo(roles.background.oklch.l, 6);
    expect(twice.text.oklch.l).toBeCloseTo(roles.text.oklch.l, 6);
  });
});
