'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { parseColor, type Gamut, type Oklch } from '@/lib/color-engine';
import {
  deriveRoles,
  flipPolarity,
  type RoleAssignment,
  type RoleColor,
  type RoleOverrides,
  type SemanticRole,
} from '@/lib/roles/semantic-roles';
import { encodeSystem } from './codec';
import { EMPTY_SYSTEM } from './defaults';
import {
  LEGACY_DOCK_STORAGE_KEY,
  SYSTEM_STORAGE_KEY,
  resolveInitialSystem,
  serializeSystem,
} from './storage';
import { systemReducer, type SystemAction } from './system-reducer';
import { decodeSystem } from './codec';
import type { ScaleSettings, System, SystemMode, TypeSettings } from './types';

/**
 * The React wiring around the System — mounted once in the root layout so the
 * document survives every route change.
 *
 * Three things happen here and nowhere else: the System is resolved from its
 * possible sources on first load, it is mirrored into the URL and
 * `localStorage` whenever it changes, and the browser's back button is wired
 * to it. The transitions themselves live in system-reducer.ts and the format
 * in codec.ts, both pure and tested; this file is only the plumbing.
 *
 * The URL is written with the History API directly rather than through the
 * Next router. `router.replace` would run a full client navigation on every
 * change — including every step of a slider drag — to update a query string
 * that no server component reads. `replaceState` keeps the address bar honest
 * for a fraction of the cost.
 */

/**
 * Actions that earn a history entry, so the back button walks a person's
 * decisions rather than every intermediate frame of a drag. Collecting a
 * color is a decision; moving the tracking slider four pixels is not.
 */
const HISTORY_ACTIONS: ReadonlySet<SystemAction['type']> = new Set([
  'addColor',
  'removeColor',
  'clearPalette',
  'setPalette',
  'setAnchor',
  'setRoleOverride',
  'clearRoleOverride',
  'setMode',
  'setScaleGlobals',
]);

interface SystemContextValue {
  readonly system: System;
  /** Roles resolved from the palette, overrides and polarity — derived once
   *  here so no two tabs can disagree about what the same System means. */
  readonly roles: RoleAssignment;
  addColor(hex: string, oklch: Oklch): void;
  removeColor(hex: string): void;
  setAnchor(hex: string): void;
  clearPalette(): void;
  setPalette(colors: readonly { readonly hex: string; readonly oklch: Oklch }[]): void;
  setRoleOverride(role: SemanticRole, hex: string): void;
  clearRoleOverride(role: SemanticRole): void;
  setType(patch: Partial<TypeSettings>): void;
  setMode(mode: SystemMode): void;
  setScale(hex: string, settings: ScaleSettings): void;
  setScaleGlobals(patch: { steps?: number; gamut?: Gamut }): void;
  /** The full shareable address of the current System. */
  shareUrl(): string;
}

const SystemContext = createContext<SystemContextValue | null>(null);

export function SystemProvider({ children }: { readonly children: ReactNode }) {
  const [system, rawDispatch] = useReducer(systemReducer, EMPTY_SYSTEM);

  // Distinguishes "not loaded yet" from "loaded and genuinely empty". Without
  // it the very first render would write an empty System over whatever the
  // person actually had, before the hydrate effect below ever ran.
  const hydratedRef = useRef(false);
  // Set by the last dispatch, read by the sync effect that follows it.
  const pushNextRef = useRef(false);

  const dispatch = useCallback((action: SystemAction) => {
    if (HISTORY_ACTIONS.has(action.type)) pushNextRef.current = true;
    rawDispatch(action);
  }, []);

  useEffect(() => {
    try {
      const resolved = resolveInitialSystem({
        search: window.location.search,
        stored: window.localStorage.getItem(SYSTEM_STORAGE_KEY),
        legacyDock: window.localStorage.getItem(LEGACY_DOCK_STORAGE_KEY),
      });
      if (resolved.source !== 'default') {
        rawDispatch({ type: 'hydrate', system: resolved.system });
      }
    } catch {
      // Storage can be unavailable entirely (private mode, disabled cookies).
      // Starting empty is a worse session, not a broken one.
    } finally {
      hydratedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;

    const query = encodeSystem(system);
    const next = query === '' ? window.location.pathname : `${window.location.pathname}?${query}`;
    const shouldPush = pushNextRef.current;
    pushNextRef.current = false;

    // Replacing an identical URL would still stack history entries on every
    // keystroke of a hex field, so compare before writing.
    const current = `${window.location.pathname}${window.location.search}`;
    if (next !== current) {
      if (shouldPush) window.history.pushState(null, '', next);
      else window.history.replaceState(null, '', next);
    }

    try {
      window.localStorage.setItem(SYSTEM_STORAGE_KEY, serializeSystem(system));
    } catch {
      // Full or unavailable storage — the System still works for this
      // session and still travels by link; it just will not survive a reload.
    }
  }, [system]);

  // Back and forward walk the System's history, which is what makes the
  // browser's own undo work without us building one.
  useEffect(() => {
    function handlePopState() {
      rawDispatch({ type: 'hydrate', system: decodeSystem(window.location.search) });
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const roles = useMemo(() => {
    const palette: RoleColor[] = system.palette.map((c) => ({ hex: c.hex, oklch: c.oklch }));
    const overrides: RoleOverrides = {};
    for (const [role, hex] of Object.entries(system.roleOverrides)) {
      if (hex === undefined) continue;
      overrides[role as SemanticRole] = { hex, oklch: parseColor(hex) };
    }
    const base = deriveRoles(palette, overrides);
    return system.mode === 'light' ? flipPolarity(base) : base;
  }, [system.palette, system.roleOverrides, system.mode]);

  const value = useMemo<SystemContextValue>(
    () => ({
      system,
      roles,
      addColor: (hex, oklch) =>
        dispatch({ type: 'addColor', hex, oklch, addedAt: Date.now() }),
      removeColor: (hex) => dispatch({ type: 'removeColor', hex }),
      setAnchor: (hex) => dispatch({ type: 'setAnchor', hex }),
      clearPalette: () => dispatch({ type: 'clearPalette' }),
      setPalette: (colors) => dispatch({ type: 'setPalette', colors }),
      setRoleOverride: (role, hex) => dispatch({ type: 'setRoleOverride', role, hex }),
      clearRoleOverride: (role) => dispatch({ type: 'clearRoleOverride', role }),
      setType: (patch) => dispatch({ type: 'setType', patch }),
      setMode: (mode) => dispatch({ type: 'setMode', mode }),
      setScale: (hex, settings) => dispatch({ type: 'setScale', hex, settings }),
      setScaleGlobals: (patch) => dispatch({ type: 'setScaleGlobals', ...patch }),
      shareUrl: () => {
        const query = encodeSystem(system);
        const { origin, pathname } = window.location;
        return query === '' ? `${origin}${pathname}` : `${origin}${pathname}?${query}`;
      },
    }),
    [system, roles, dispatch]
  );

  return <SystemContext.Provider value={value}>{children}</SystemContext.Provider>;
}

export function useSystem(): SystemContextValue {
  const context = useContext(SystemContext);
  if (context === null) {
    throw new Error('useSystem must be used within a SystemProvider (see app/layout.tsx)');
  }
  return context;
}
