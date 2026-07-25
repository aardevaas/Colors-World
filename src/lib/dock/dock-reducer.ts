import type { Oklch } from '@/lib/color-engine';

/**
 * Pure state transitions for the Harmonic Collector Dock — the persistent,
 * cross-route colour tray from the Library spec. Kept separate from the
 * React context/provider (dock-context.tsx) so the actual state-machine
 * logic — in particular, what happens to the Primary Anchor when items are
 * added/removed — is unit-testable without mounting a component or faking
 * localStorage.
 */

export interface DockItem {
  readonly hex: string;
  readonly oklch: Oklch;
  readonly addedAt: number;
}

export interface DockState {
  readonly items: readonly DockItem[];
  readonly primaryAnchorHex: string | null;
}

export const EMPTY_DOCK_STATE: DockState = { items: [], primaryAnchorHex: null };

export type DockAction =
  | { readonly type: 'hydrate'; readonly state: DockState }
  | { readonly type: 'add'; readonly hex: string; readonly oklch: Oklch; readonly addedAt: number }
  | { readonly type: 'remove'; readonly hex: string }
  | { readonly type: 'setPrimaryAnchor'; readonly hex: string }
  | { readonly type: 'clear' };

export function dockReducer(state: DockState, action: DockAction): DockState {
  switch (action.type) {
    case 'hydrate':
      return action.state;

    case 'add': {
      if (state.items.some((item) => item.hex === action.hex)) return state;
      const nextItems = [
        ...state.items,
        { hex: action.hex, oklch: action.oklch, addedAt: action.addedAt },
      ];
      // "The first collected colour automatically becomes the default
      // Primary Anchor" — only when there isn't one already; adding more
      // colours later never bumps an existing anchor.
      return {
        items: nextItems,
        primaryAnchorHex: state.primaryAnchorHex ?? action.hex,
      };
    }

    case 'remove': {
      const nextItems = state.items.filter((item) => item.hex !== action.hex);
      // Removing the current anchor promotes the next-oldest remaining item
      // rather than leaving items in the dock with no anchor at all, which
      // "Open in Scale Lab" has nothing sensible to do with.
      const nextAnchor =
        state.primaryAnchorHex === action.hex
          ? (nextItems[0]?.hex ?? null)
          : state.primaryAnchorHex;
      return { items: nextItems, primaryAnchorHex: nextAnchor };
    }

    case 'setPrimaryAnchor':
      // Silently ignores a hex not currently in the dock, rather than
      // pointing the anchor at something that isn't there — this is a
      // reducer, not a validator with anywhere to surface an error.
      return state.items.some((item) => item.hex === action.hex)
        ? { ...state, primaryAnchorHex: action.hex }
        : state;

    case 'clear':
      return EMPTY_DOCK_STATE;

    default:
      return state;
  }
}
