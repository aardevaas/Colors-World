/**
 * Turns a System into a query string and back.
 *
 * The URL is the System's source of truth, which buys sharing, undo (browser
 * back), persistence and cross-tab hand-off in one move — the mechanism behind
 * every competitor that feels like one product instead of several. So the
 * format has two jobs beyond correctness: it has to stay short enough to paste
 * into a message, and readable enough that a designer can hand-edit a hex in it
 * without a decoder ring.
 *
 *   c=5a3f73-19d368-cfa15d              palette, in collection order
 *   a=19d368                            the anchor scales are built from
 *   r=primary.cfa15d,text.ffffff        manual role assignments
 *   t=editorial~1.333~1.125~1.7~0.02~500  preset, ratio, base, leading, tracking, weight
 *   m=light                             polarity
 *
 * Anything already at its default is left out entirely, so a first-time
 * visitor gets a clean URL rather than a query string reciting the defaults
 * back at them.
 *
 * **Decoding never throws.** A URL is user-editable input arriving from a
 * chat message, a bookmark or a typo; every field independently falls back to
 * its default, and a single bad colour costs you that colour, not the page.
 */

import { formatHex, parseColor } from '@/lib/color-engine';
import { SEMANTIC_ROLES, type SemanticRole } from '@/lib/roles/semantic-roles';
import { TYPE_PRESETS } from '@/lib/typography/font-sources';
import { DEFAULT_TYPE, EMPTY_SYSTEM } from './defaults';
import type { System, SystemColor, SystemMode, TypeSettings } from './types';

const PARAM_PALETTE = 'c';
const PARAM_ANCHOR = 'a';
const PARAM_ROLES = 'r';
const PARAM_TYPE = 't';
const PARAM_MODE = 'm';

/**
 * A hand-edited URL is the one input nobody can validate before it arrives, so
 * the palette is capped. Without this, `c=` with a few thousand segments parses
 * a few thousand colours and lays out a few thousand DOM nodes before anything
 * paints.
 */
const MAX_PALETTE = 32;

const HEX6 = /^#?[0-9a-f]{6}$/i;
const TYPE_SEPARATOR = '~';

/** Bounds that keep a hand-edited URL from rendering something impossible. */
const TYPE_BOUNDS = {
  ratio: { min: 1.0, max: 3 },
  baseRem: { min: 0.5, max: 4 },
  lineHeight: { min: 0.8, max: 3 },
  tracking: { min: -0.2, max: 0.5 },
  weight: { min: 100, max: 900 },
} as const;

// ---------------------------------------------------------------- encoding

export function encodeSystem(system: System): string {
  const parts: string[] = [];

  if (system.palette.length > 0) {
    parts.push(`${PARAM_PALETTE}=${system.palette.map((c) => bareHex(c.hex)).join('-')}`);
  }

  // The anchor is only worth writing when it is not the one we would infer.
  const impliedAnchor = system.palette[0]?.hex ?? null;
  if (
    system.anchorHex !== null &&
    bareHex(system.anchorHex) !== (impliedAnchor === null ? null : bareHex(impliedAnchor))
  ) {
    parts.push(`${PARAM_ANCHOR}=${bareHex(system.anchorHex)}`);
  }

  const roles = SEMANTIC_ROLES.flatMap((role) => {
    const hex = system.roleOverrides[role];
    return hex === undefined ? [] : [`${role}.${bareHex(hex)}`];
  });
  if (roles.length > 0) parts.push(`${PARAM_ROLES}=${roles.join(',')}`);

  if (!isDefaultType(system.type)) {
    const t = system.type;
    parts.push(
      `${PARAM_TYPE}=${[t.presetId, t.ratio, t.baseRem, t.lineHeight, t.tracking, t.weight].join(
        TYPE_SEPARATOR
      )}`
    );
  }

  if (system.mode !== EMPTY_SYSTEM.mode) parts.push(`${PARAM_MODE}=${system.mode}`);

  return parts.join('&');
}

/** True when nothing has been configured, so the URL can stay bare. */
export function isDefaultSystem(system: System): boolean {
  return encodeSystem(system) === '';
}

// ---------------------------------------------------------------- decoding

export function decodeSystem(search: string): System {
  // URLSearchParams handles a leading '?', repeated keys and percent-encoding,
  // and throws on none of them.
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);

  const palette = decodePalette(params.get(PARAM_PALETTE));
  return {
    palette,
    anchorHex: decodeAnchor(params.get(PARAM_ANCHOR), palette),
    roleOverrides: decodeRoles(params.get(PARAM_ROLES)),
    type: decodeType(params.get(PARAM_TYPE)),
    mode: params.get(PARAM_MODE) === 'light' ? 'light' : 'dark',
  };
}

function decodePalette(raw: string | null): readonly SystemColor[] {
  if (raw === null || raw === '') return [];
  const seen = new Set<string>();
  const out: SystemColor[] = [];
  for (const segment of raw.split('-')) {
    if (out.length >= MAX_PALETTE) break;
    const hex = normalizeHex(segment);
    if (hex === null || seen.has(hex)) continue;
    seen.add(hex);
    // addedAt is positional rather than a real timestamp: the URL carries
    // order, not history, and order is the only part anything reads.
    out.push({ hex, oklch: parseColor(hex), addedAt: out.length });
  }
  return out;
}

function decodeAnchor(raw: string | null, palette: readonly SystemColor[]): string | null {
  if (palette.length === 0) return null;
  const wanted = raw === null ? null : normalizeHex(raw);
  // An anchor naming a colour that is not in the palette would leave the
  // scale builder pointing at something nobody can see.
  const match = wanted === null ? undefined : palette.find((c) => c.hex === wanted);
  return match?.hex ?? palette[0]!.hex;
}

function decodeRoles(raw: string | null): Readonly<Partial<Record<SemanticRole, string>>> {
  if (raw === null || raw === '') return {};
  const out: Partial<Record<SemanticRole, string>> = {};
  for (const pair of raw.split(',')) {
    const dot = pair.indexOf('.');
    if (dot < 1) continue;
    const role = pair.slice(0, dot);
    if (!isSemanticRole(role)) continue;
    const hex = normalizeHex(pair.slice(dot + 1));
    if (hex === null) continue;
    out[role] = hex;
  }
  return out;
}

function decodeType(raw: string | null): TypeSettings {
  if (raw === null || raw === '') return DEFAULT_TYPE;
  const [presetId, ratio, baseRem, lineHeight, tracking, weight] = raw.split(TYPE_SEPARATOR);
  return {
    // Only presets we actually ship — an unknown id would render in whatever
    // the browser felt like and look like a font-loading bug.
    presetId: TYPE_PRESETS.some((p) => p.id === presetId) ? presetId! : DEFAULT_TYPE.presetId,
    ratio: clampNumber(ratio, TYPE_BOUNDS.ratio, DEFAULT_TYPE.ratio),
    baseRem: clampNumber(baseRem, TYPE_BOUNDS.baseRem, DEFAULT_TYPE.baseRem),
    lineHeight: clampNumber(lineHeight, TYPE_BOUNDS.lineHeight, DEFAULT_TYPE.lineHeight),
    tracking: clampNumber(tracking, TYPE_BOUNDS.tracking, DEFAULT_TYPE.tracking),
    weight: Math.round(clampNumber(weight, TYPE_BOUNDS.weight, DEFAULT_TYPE.weight)),
  };
}

// ---------------------------------------------------------------- helpers

function isSemanticRole(value: string): value is SemanticRole {
  return (SEMANTIC_ROLES as readonly string[]).includes(value);
}

/** `#5A3F73` / `5a3f73` / `%235a3f73` all become `#5a3f73`; anything else null. */
function normalizeHex(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (!HEX6.test(trimmed)) return null;
  return `#${trimmed.replace('#', '').toLowerCase()}`;
}

function bareHex(hex: string): string {
  return hex.replace('#', '').toLowerCase();
}

function clampNumber(
  raw: string | undefined,
  bounds: { readonly min: number; readonly max: number },
  fallback: number
): number {
  const parsed = raw === undefined ? Number.NaN : Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(bounds.max, Math.max(bounds.min, parsed));
}

function isDefaultType(type: TypeSettings): boolean {
  return (
    type.presetId === DEFAULT_TYPE.presetId &&
    type.ratio === DEFAULT_TYPE.ratio &&
    type.baseRem === DEFAULT_TYPE.baseRem &&
    type.lineHeight === DEFAULT_TYPE.lineHeight &&
    type.tracking === DEFAULT_TYPE.tracking &&
    type.weight === DEFAULT_TYPE.weight
  );
}

/** Re-exported so callers never hand-write `#` handling. */
export function toSystemColor(hex: string, addedAt: number): SystemColor | null {
  const normalized = normalizeHex(hex);
  if (normalized === null) return null;
  return { hex: normalized, oklch: parseColor(normalized), addedAt };
}

/** Formats an OKLCH back to the hex form the System stores. */
export function systemHex(oklch: Parameters<typeof formatHex>[0]): string {
  return formatHex(oklch).toLowerCase();
}
