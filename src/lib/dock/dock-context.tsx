'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import type { Oklch } from '@/lib/color-engine';
import { EMPTY_DOCK_STATE, dockReducer, type DockItem, type DockState } from './dock-reducer';

/**
 * The Harmonic Collector Dock's provider — mounted once in the root layout
 * (see app/layout.tsx) so it survives every route navigation, unlike the
 * per-page Spectrum tray it replaces (see spectrum/CollectTray.tsx), which
 * reset on every visit to /spectrum specifically. State transitions
 * themselves live in dock-reducer.ts, kept pure and tested there; this file
 * is just the React wiring — context, localStorage persistence, and the
 * public hook.
 */

const DOCK_STORAGE_KEY = 'colorsworld.dock.v1';

interface DockContextValue {
  readonly items: readonly DockItem[];
  readonly primaryAnchorHex: string | null;
  addToDock(hex: string, oklch: Oklch): void;
  removeFromDock(hex: string): void;
  setPrimaryAnchor(hex: string): void;
  clearDock(): void;
}

const DockContext = createContext<DockContextValue | null>(null);

export function DockProvider({ children }: { readonly children: ReactNode }) {
  const [state, dispatch] = useReducer(dockReducer, EMPTY_DOCK_STATE);
  // Distinguishes "haven't loaded localStorage yet" from "loaded and it was
  // genuinely empty" — without this, the very first render (before the
  // hydrate effect below runs) would immediately persist the empty initial
  // state right back over whatever was actually saved.
  const hydratedRef = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DOCK_STORAGE_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw) as DockState;
        dispatch({ type: 'hydrate', state: parsed });
      }
    } catch {
      // Corrupt or inaccessible storage — start with an empty dock rather
      // than breaking every page over a persistence nicety.
    } finally {
      hydratedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      window.localStorage.setItem(DOCK_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full or unavailable — the dock still works for this
      // session, it just won't survive a reload.
    }
  }, [state]);

  const addToDock = useCallback((hex: string, oklch: Oklch) => {
    dispatch({ type: 'add', hex, oklch, addedAt: Date.now() });
  }, []);
  const removeFromDock = useCallback((hex: string) => {
    dispatch({ type: 'remove', hex });
  }, []);
  const setPrimaryAnchor = useCallback((hex: string) => {
    dispatch({ type: 'setPrimaryAnchor', hex });
  }, []);
  const clearDock = useCallback(() => {
    dispatch({ type: 'clear' });
  }, []);

  return (
    <DockContext.Provider
      value={{
        items: state.items,
        primaryAnchorHex: state.primaryAnchorHex,
        addToDock,
        removeFromDock,
        setPrimaryAnchor,
        clearDock,
      }}
    >
      {children}
    </DockContext.Provider>
  );
}

export function useDock(): DockContextValue {
  const context = useContext(DockContext);
  if (context === null) {
    throw new Error('useDock must be used within a DockProvider (see app/layout.tsx)');
  }
  return context;
}
