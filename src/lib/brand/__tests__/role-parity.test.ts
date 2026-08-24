import { describe, expect, test } from 'vitest';
import { parseColor } from '@/lib/color-engine';
import {
  SEMANTIC_ROLES,
  deriveRoles,
  flipPolarity,
  type RoleColor,
  type RoleOverrides,
  type SemanticRole,
} from '@/lib/roles/semantic-roles';
import { EMPTY_SYSTEM } from '@/lib/system/defaults';
import type { System } from '@/lib/system/types';
import { systemRoles } from '../colour';

/**
 * The System's colour half is turned into roles in TWO places, on purpose.
 *
 * `systemRoles` (lib/brand/colour.ts) is pure and callable from the Book's
 * renderer; `SystemProvider`'s `roles` memo (lib/system/system-context.tsx) is
 * React state and is what every room paints from. They are deliberately
 * separate — one cannot be used where the other lives — and nothing has ever
 * enforced that they agree.
 *
 * If they drift, the book prints different colours than the room the person
 * just left, which is precisely the class of bug the shared role model was
 * built to end. This reproduces the provider's memo exactly and holds the two
 * to the same answer.
 *
 * The order is load-bearing and is the part that was got wrong once already:
 * derive, apply overrides, THEN flip. Flipping first hands `flipPolarity` a
 * mapping the person never chose.
 */
function providerRoles(system: System) {
  const palette: RoleColor[] = system.palette.map((c) => ({ hex: c.hex, oklch: c.oklch }));
  const overrides: RoleOverrides = {};
  for (const [role, hex] of Object.entries(system.roleOverrides)) {
    if (hex === undefined) continue;
    overrides[role as SemanticRole] = { hex, oklch: parseColor(hex) };
  }
  const base = deriveRoles(palette, overrides);
  return system.mode === 'light' ? flipPolarity(base) : base;
}

const PALETTES: readonly (readonly string[])[] = [
  [],
  ['#0a5cff'],
  ['#0a5cff', '#1b1b1f'],
  ['#0a5cff', '#ff6b35', '#1b1b1f'],
  ['#0a5cff', '#ff6b35', '#1b1b1f', '#f5f5f7', '#00a67e'],
  ['#7c5cff', '#22d3ee', '#facc15', '#0f172a', '#f8fafc', '#ec4899'],
];

const systemWith = (hexes: readonly string[], patch: Partial<System> = {}): System => ({
  ...EMPTY_SYSTEM,
  palette: hexes.map((hex, i) => ({ hex, oklch: parseColor(hex), addedAt: i })),
  anchorHex: hexes[0] ?? null,
  ...patch,
});

describe('the book and the rooms derive the same roles', () => {
  for (const hexes of PALETTES) {
    for (const mode of ['dark', 'light'] as const) {
      const label = `${hexes.length} colour${hexes.length === 1 ? '' : 's'} · ${mode}`;

      test(`agree on every role — ${label}`, () => {
        const system = systemWith(hexes, { mode });
        const book = systemRoles(system);
        const room = providerRoles(system);
        for (const role of SEMANTIC_ROLES) {
          expect(book[role].hex, `${role} @ ${label}`).toBe(room[role].hex);
        }
      });
    }
  }

  test('agree when a role is manually overridden', () => {
    const system = systemWith(['#0a5cff', '#ff6b35', '#1b1b1f'], {
      roleOverrides: { primary: '#00a67e', surface: '#222228' },
      mode: 'light',
    });
    const book = systemRoles(system);
    const room = providerRoles(system);
    for (const role of SEMANTIC_ROLES) {
      expect(book[role].hex, role).toBe(room[role].hex);
    }
  });
});
