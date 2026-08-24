/**
 * Turning the System's colour half into the shapes §3 renders from.
 *
 * The System stores role overrides as bare hex strings — that is what fits in
 * a URL — while `deriveRoles` wants parsed colours, and light mode is a
 * polarity flip applied after derivation rather than a second palette.
 *
 * This must stay in step with `SystemProvider`'s `roles` memo
 * (`src/lib/system/system-context.tsx`), which is what every room renders
 * from. The two are deliberately separate — that one is React state, this one
 * is pure and callable from a renderer — but if they disagree, the book prints
 * different colours than the room the person just left, which is the exact
 * class of bug the shared role model was built to end.
 *
 * The two other `deriveRoles` call sites in the app pass no overrides, and
 * that is correct rather than a bug: `PaletteComposer.auditOf` grades a *draft*
 * palette and `harmony/solver.evaluate` grades *generated* candidates. In both,
 * an override points at a hex the palette being graded may not even contain.
 */

import { parseColor } from '@/lib/color-engine';
import {
  deriveRoles,
  flipPolarity,
  type RoleAssignment,
  type RoleColor,
  type RoleOverrides,
  type SemanticRole,
} from '@/lib/roles/semantic-roles';
import type { System } from '@/lib/system/types';

/** The System's palette in the shape the role model expects. */
export function paletteColors(system: System): readonly RoleColor[] {
  return system.palette.map((c) => ({ hex: c.hex, oklch: c.oklch }));
}

/**
 * The System's role assignment: manual overrides applied, then polarity.
 *
 * Order matters and is not interchangeable. Overrides are a choice about which
 * colour plays a role; polarity is a choice about which way round the whole
 * interface reads. Flipping first would hand `flipPolarity` a mapping the
 * person never chose.
 */
export function systemRoles(system: System): RoleAssignment {
  const overrides: RoleOverrides = {};
  for (const [role, hex] of Object.entries(system.roleOverrides)) {
    if (typeof hex === 'string') {
      overrides[role as SemanticRole] = { hex, oklch: parseColor(hex) };
    }
  }
  const base = deriveRoles(paletteColors(system), overrides);
  return system.mode === 'light' ? flipPolarity(base) : base;
}

/** True when there is nothing to render a colour component from. */
export function hasPalette(system: System): boolean {
  return system.palette.length > 0;
}
