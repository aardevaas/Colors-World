/**
 * Where a System comes from when a page loads, and in what order.
 *
 * Three sources can supply one, and the precedence between them is a product
 * decision rather than a technical one, so it lives here as pure logic with
 * tests rather than inside an effect:
 *
 *   1. the URL — someone followed a link, and that link's System is the whole
 *      point of following it;
 *   2. this browser's last System — they came back to the bare site and should
 *      find their work where they left it;
 *   3. the old Harmonic Dock — they collected colors before the System
 *      existed, and losing that collection on upgrade would be unforgivable.
 *
 * Every reader is defensive: stored JSON can be corrupt, from a future version,
 * or edited by hand in devtools. Anything unparseable is treated as absent
 * rather than fatal, because the alternative is a blank page on load.
 */

import { parseColor } from '@/lib/color-engine';
import { decodeSystem, encodeSystem, isDefaultSystem } from './codec';
import { EMPTY_SYSTEM } from './defaults';
import type { System, SystemColor } from './types';

export const SYSTEM_STORAGE_KEY = 'colorsworld.system.v1';
/** The pre-System dock. Read once for migration, never written again. */
export const LEGACY_DOCK_STORAGE_KEY = 'colorsworld.dock.v1';

const MAX_PALETTE = 32;
const HEX6 = /^#[0-9a-f]{6}$/i;

/**
 * Serialises for `localStorage` using the URL grammar rather than JSON, so
 * there is exactly one format to keep working and one to test. Two formats
 * would eventually disagree, and the disagreement would only ever show up on
 * someone else's reload.
 */
export function serializeSystem(system: System): string {
  return encodeSystem(system);
}

/** Reads a System previously written by `serializeSystem`. */
export function deserializeSystem(raw: string | null): System | null {
  if (raw === null || raw.trim() === '') return null;
  try {
    return decodeSystem(raw);
  } catch {
    return null;
  }
}

/**
 * Converts a pre-System Harmonic Dock into a System, so nobody loses the
 * colors they had collected when this ships.
 */
export function migrateLegacyDock(raw: string | null): System | null {
  if (raw === null || raw.trim() === '') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const items = (parsed as { items?: unknown }).items;
  if (!Array.isArray(items)) return null;

  const palette: SystemColor[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (palette.length >= MAX_PALETTE) break;
    if (typeof item !== 'object' || item === null) continue;
    const hex = (item as { hex?: unknown }).hex;
    if (typeof hex !== 'string' || !HEX6.test(hex)) continue;
    const lower = hex.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    // The stored oklch is not trusted: it was written by an older build and
    // may disagree with its own hex. Recomputing costs nothing and the hex is
    // the thing a person actually chose.
    palette.push({ hex: lower, oklch: parseColor(lower), addedAt: palette.length });
  }
  if (palette.length === 0) return null;

  const rawAnchor = (parsed as { primaryAnchorHex?: unknown }).primaryAnchorHex;
  const anchor =
    typeof rawAnchor === 'string' && seen.has(rawAnchor.toLowerCase())
      ? rawAnchor.toLowerCase()
      : palette[0]!.hex;

  return { ...EMPTY_SYSTEM, palette, anchorHex: anchor };
}

export interface SystemSources {
  /** `location.search`, or '' when there is none. */
  readonly search: string;
  /** Raw value at `SYSTEM_STORAGE_KEY`. */
  readonly stored: string | null;
  /** Raw value at `LEGACY_DOCK_STORAGE_KEY`. */
  readonly legacyDock: string | null;
}

export interface ResolvedSystem {
  readonly system: System;
  /** Which source won — the provider uses this to decide whether to write the
   *  URL back immediately, and it makes the precedence visible in tests. */
  readonly source: 'url' | 'storage' | 'legacy-dock' | 'default';
}

export function resolveInitialSystem(sources: SystemSources): ResolvedSystem {
  const fromUrl = decodeSystem(sources.search);
  // A bare URL is not a request for an empty System — it is the absence of a
  // request, so it must not wipe what this browser already had.
  if (!isDefaultSystem(fromUrl)) return { system: fromUrl, source: 'url' };

  const stored = deserializeSystem(sources.stored);
  if (stored !== null && !isDefaultSystem(stored)) return { system: stored, source: 'storage' };

  const migrated = migrateLegacyDock(sources.legacyDock);
  if (migrated !== null) return { system: migrated, source: 'legacy-dock' };

  return { system: EMPTY_SYSTEM, source: 'default' };
}
