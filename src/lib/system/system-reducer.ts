/**
 * The only thing that changes a System.
 *
 * Kept pure and separate from the React provider (system-context.tsx) so the
 * transitions that actually carry product rules — what happens to the anchor
 * when its colour is removed, whether adding a duplicate is a no-op — are
 * testable without mounting a component, faking localStorage or driving a
 * router. This is the same split the dock reducer had; the state it operates
 * on is simply now the whole document rather than one tray.
 */

import type { Oklch } from '@/lib/color-engine';
import type { SemanticRole } from '@/lib/roles/semantic-roles';
import { EMPTY_SYSTEM } from './defaults';
import type { System, SystemMode, TypeSettings } from './types';

/** Matches the codec's cap, so no route into the System can exceed it. */
const MAX_PALETTE = 32;

export type SystemAction =
  | { readonly type: 'hydrate'; readonly system: System }
  | { readonly type: 'addColor'; readonly hex: string; readonly oklch: Oklch; readonly addedAt: number }
  | { readonly type: 'removeColor'; readonly hex: string }
  | { readonly type: 'setAnchor'; readonly hex: string }
  | { readonly type: 'clearPalette' }
  | {
      readonly type: 'setPalette';
      readonly colors: readonly { readonly hex: string; readonly oklch: Oklch }[];
    }
  | { readonly type: 'setRoleOverride'; readonly role: SemanticRole; readonly hex: string }
  | { readonly type: 'clearRoleOverride'; readonly role: SemanticRole }
  | { readonly type: 'setType'; readonly patch: Partial<TypeSettings> }
  | { readonly type: 'setMode'; readonly mode: SystemMode };

export function systemReducer(state: System, action: SystemAction): System {
  switch (action.type) {
    case 'hydrate':
      return action.system;

    case 'addColor': {
      const hex = action.hex.toLowerCase();
      if (state.palette.some((c) => c.hex.toLowerCase() === hex)) return state;
      if (state.palette.length >= MAX_PALETTE) return state;
      const palette = [...state.palette, { hex, oklch: action.oklch, addedAt: action.addedAt }];
      // The first colour collected becomes the anchor automatically; later
      // additions never bump an anchor that is already chosen.
      return { ...state, palette, anchorHex: state.anchorHex ?? hex };
    }

    case 'removeColor': {
      const hex = action.hex.toLowerCase();
      const palette = state.palette.filter((c) => c.hex.toLowerCase() !== hex);
      if (palette.length === state.palette.length) return state;
      // Removing the anchor promotes the next-oldest colour rather than
      // leaving a populated palette with nothing to build scales from.
      const anchorHex =
        state.anchorHex?.toLowerCase() === hex ? (palette[0]?.hex ?? null) : state.anchorHex;
      // A role pinned to a colour that no longer exists would keep painting a
      // colour absent from the palette, with no swatch to explain where it
      // came from. Drop those pins and let the role derive again.
      const roleOverrides = dropOverridesFor(state.roleOverrides, hex);
      return { ...state, palette, anchorHex, roleOverrides };
    }

    case 'setAnchor': {
      const hex = action.hex.toLowerCase();
      // Ignores a hex that is not in the palette — this is a reducer, with
      // nowhere to surface an error, and a dangling anchor is worse than none.
      return state.palette.some((c) => c.hex.toLowerCase() === hex)
        ? { ...state, anchorHex: hex }
        : state;
    }

    case 'clearPalette':
      return { ...state, palette: [], anchorHex: null, roleOverrides: {} };

    case 'setPalette': {
      // Replacing the palette wholesale, as the generator does. Overrides are
      // dropped rather than carried: they pinned roles to colours from the
      // previous palette, and keeping them would paint a generated system with
      // colours that are no longer in it and have no swatch to explain them.
      const seen = new Set<string>();
      const palette = [];
      for (const color of action.colors) {
        const hex = color.hex.toLowerCase();
        if (seen.has(hex) || palette.length >= MAX_PALETTE) continue;
        seen.add(hex);
        palette.push({ hex, oklch: color.oklch, addedAt: palette.length });
      }
      return {
        ...state,
        palette,
        anchorHex: palette[0]?.hex ?? null,
        roleOverrides: {},
      };
    }

    case 'setRoleOverride':
      return {
        ...state,
        roleOverrides: { ...state.roleOverrides, [action.role]: action.hex.toLowerCase() },
      };

    case 'clearRoleOverride': {
      if (state.roleOverrides[action.role] === undefined) return state;
      const roleOverrides = { ...state.roleOverrides };
      delete roleOverrides[action.role];
      return { ...state, roleOverrides };
    }

    case 'setType':
      return { ...state, type: { ...state.type, ...action.patch } };

    case 'setMode':
      return state.mode === action.mode ? state : { ...state, mode: action.mode };

    default:
      return state;
  }
}

function dropOverridesFor(
  overrides: System['roleOverrides'],
  hex: string
): System['roleOverrides'] {
  const entries = Object.entries(overrides).filter(([, value]) => value?.toLowerCase() !== hex);
  return Object.fromEntries(entries) as System['roleOverrides'];
}

export { EMPTY_SYSTEM };
