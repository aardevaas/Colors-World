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
 *   sg=8~p3                             scale steps and gamut
 *   s=0~n:brand~c:1.2,2~t:15            per-scale settings, by palette index
 *   m=light                             polarity
 *
 * Scales are referenced by their index into `c` rather than by hex, because
 * the palette is already sitting beside them and six characters per reference
 * adds up fast. The model keys them by hex instead — see `ScaleSystem`.
 *
 * Anything already at its default is left out entirely, so a first-time
 * visitor gets a clean URL rather than a query string reciting the defaults
 * back at them.
 *
 * **Decoding never throws.** A URL is user-editable input arriving from a
 * chat message, a bookmark or a typo; every field independently falls back to
 * its default, and a single bad colour costs you that colour, not the page.
 */

import { formatHex, parseColor, type ControlPoint, type Gamut } from '@/lib/color-engine';
import { SEMANTIC_ROLES, type SemanticRole } from '@/lib/roles/semantic-roles';
import { TYPE_PRESETS } from '@/lib/typography/font-sources';
import { DEFAULT_SCALES, DEFAULT_TYPE, EMPTY_SYSTEM } from './defaults';
import type {
  ScaleSettings,
  ScaleSystem,
  System,
  SystemColor,
  SystemMode,
  TypeSettings,
} from './types';

const PARAM_PALETTE = 'c';
const PARAM_ANCHOR = 'a';
const PARAM_ROLES = 'r';
const PARAM_TYPE = 't';
const PARAM_MODE = 'm';
const PARAM_SCALE_GLOBALS = 'sg';
const PARAM_SCALES = 's';

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

  const scaleGlobals = encodeScaleGlobals(system.scales);
  if (scaleGlobals !== null) parts.push(`${PARAM_SCALE_GLOBALS}=${scaleGlobals}`);

  const scales = encodeScales(system.scales, system.palette);
  if (scales !== null) parts.push(`${PARAM_SCALES}=${scales}`);

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
    scales: decodeScales(
      params.get(PARAM_SCALE_GLOBALS),
      params.get(PARAM_SCALES),
      palette
    ),
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


// ------------------------------------------------------------------ scales

/** Curve points live in 0..1; three decimals is finer than any handle a
 *  person can drag and keeps a six-point curve under forty characters. */
const CURVE_PRECISION = 3;
const MAX_CURVE_POINTS = 12;
const MAX_SCALE_NAME = 24;

const CURVE_KEYS = {
  lightnessCurve: 'l',
  chromaCurve: 'm',
  hueTorsionCurve: 'h',
} as const;

const GAMUTS: readonly Gamut[] = ['srgb', 'p3', 'rec2020', 'print'];

const SCALE_BOUNDS = {
  steps: { min: 2, max: 10 },
  chromaIntensity: { min: 0, max: 2 },
  hueTorsion: { min: -180, max: 180 },
} as const;

function encodeScaleGlobals(scales: ScaleSystem): string | null {
  if (scales.steps === DEFAULT_SCALES.steps && scales.gamut === DEFAULT_SCALES.gamut) return null;
  return `${scales.steps}${TYPE_SEPARATOR}${scales.gamut}`;
}

function encodeScales(scales: ScaleSystem, palette: readonly SystemColor[]): string | null {
  const entries: string[] = [];

  palette.forEach((color, index) => {
    const settings = scales.byHex[color.hex.toLowerCase()];
    if (settings === undefined) return;

    const fields: string[] = [];
    if (settings.name !== undefined && settings.name !== '') {
      fields.push(`n:${encodeScaleName(settings.name)}`);
    }
    if (settings.chromaIntensity !== undefined && settings.chromaIntensity !== 1) {
      fields.push(`c:${round(settings.chromaIntensity, 2)}`);
    }
    if (settings.hueTorsion !== undefined && settings.hueTorsion !== 0) {
      fields.push(`t:${round(settings.hueTorsion, 2)}`);
    }
    for (const [key, short] of Object.entries(CURVE_KEYS)) {
      const curve = settings[key as keyof typeof CURVE_KEYS];
      if (curve === undefined || curve.length === 0) continue;
      fields.push(`${short}:${encodeCurve(curve)}`);
    }

    // A scale whose settings are all defaults is not worth a slot.
    if (fields.length === 0) return;
    entries.push([String(index), ...fields].join(TYPE_SEPARATOR));
  });

  return entries.length === 0 ? null : entries.join(',');
}

function decodeScales(
  rawGlobals: string | null,
  rawScales: string | null,
  palette: readonly SystemColor[]
): ScaleSystem {
  const [steps, gamut] = (rawGlobals ?? '').split(TYPE_SEPARATOR);

  const byHex: Record<string, ScaleSettings> = {};
  for (const entry of (rawScales ?? '').split(',')) {
    if (entry === '') continue;
    const [rawIndex, ...fields] = entry.split(TYPE_SEPARATOR);
    const index = Number(rawIndex);
    // An index past the end of the palette refers to a colour that is not
    // here — from a hand-edited URL, or a link whose palette was trimmed.
    if (!Number.isInteger(index) || index < 0 || index >= palette.length) continue;

    const settings = decodeScaleFields(fields);
    if (Object.keys(settings).length === 0) continue;
    byHex[palette[index]!.hex.toLowerCase()] = settings;
  }

  return {
    steps: Math.round(clampNumber(steps, SCALE_BOUNDS.steps, DEFAULT_SCALES.steps)),
    gamut: GAMUTS.includes(gamut as Gamut) ? (gamut as Gamut) : DEFAULT_SCALES.gamut,
    byHex,
  };
}

function decodeScaleFields(fields: readonly string[]): ScaleSettings {
  const settings: {
    name?: string;
    chromaIntensity?: number;
    hueTorsion?: number;
    lightnessCurve?: readonly ControlPoint[];
    chromaCurve?: readonly ControlPoint[];
    hueTorsionCurve?: readonly ControlPoint[];
  } = {};

  for (const field of fields) {
    const colon = field.indexOf(':');
    if (colon < 1) continue;
    const key = field.slice(0, colon);
    const value = field.slice(colon + 1);

    if (key === 'n') {
      const name = decodeScaleName(value);
      if (name !== '') settings.name = name;
    } else if (key === 'c') {
      settings.chromaIntensity = clampNumber(value, SCALE_BOUNDS.chromaIntensity, 1);
    } else if (key === 't') {
      settings.hueTorsion = clampNumber(value, SCALE_BOUNDS.hueTorsion, 0);
    } else {
      const curveKey = (Object.keys(CURVE_KEYS) as (keyof typeof CURVE_KEYS)[]).find(
        (candidate) => CURVE_KEYS[candidate] === key
      );
      if (curveKey === undefined) continue;
      const curve = decodeCurve(value);
      if (curve !== null) settings[curveKey] = curve;
    }
  }
  return settings;
}

function encodeCurve(points: readonly ControlPoint[]): string {
  return points
    .slice(0, MAX_CURVE_POINTS)
    .map((point) => `${round(point.x, CURVE_PRECISION)}_${round(point.y, CURVE_PRECISION)}`)
    .join('|');
}

/**
 * Returns null rather than a partial curve: a curve is a shape, and half of
 * one is not a lesser version of it — the interpolator needs sorted, distinct
 * x values, and a silently truncated curve would render as something the
 * person never drew.
 */
function decodeCurve(raw: string): readonly ControlPoint[] | null {
  const parts = raw.split('|');
  if (parts.length < 2 || parts.length > MAX_CURVE_POINTS) return null;

  const points: ControlPoint[] = [];
  for (const part of parts) {
    const [rawX, rawY] = part.split('_');
    const x = Number(rawX);
    const y = Number(rawY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    points.push({ x: clamp01(x), y: clamp01(y) });
  }

  // The interpolator requires ascending, distinct x values and throws
  // otherwise, so a malformed curve has to be rejected here rather than
  // taken on trust and crashing a render.
  for (let i = 1; i < points.length; i++) {
    if (points[i]!.x <= points[i - 1]!.x) return null;
  }
  return points;
}

/**
 * Escapes the characters that would otherwise be read as grammar.
 *
 * Percent-encoding cannot be used here, which is not obvious: `URLSearchParams`
 * decodes the whole value before this parser ever sees it, so a name written
 * as `a%7Eb` arrives as `a~b` and splits down the middle. The escape therefore
 * has to survive one round of percent-decoding, which means using a character
 * that percent-encoding leaves alone.
 *
 * `!` is that character -- unreserved in a query string, untouched by
 * `encodeURIComponent`, and rare enough in a scale name that the doubled form
 * is seldom seen.
 */
const NAME_ESCAPES: readonly (readonly [string, string])[] = [
  ['!', '!!'],
  ['~', '!t'],
  [',', '!c'],
  [':', '!o'],
  ['&', '!a'],
  ['=', '!e'],
  // `+` decodes to a space in a query string, so a name containing one would
  // come back altered rather than broken -- the worse of the two failures.
  ['+', '!p'],
];

function encodeScaleName(name: string): string {
  let out = name.slice(0, MAX_SCALE_NAME);
  // `!` first: every other replacement introduces one, and escaping those
  // again would double them on the way back.
  for (const [plain, escaped] of NAME_ESCAPES) out = out.split(plain).join(escaped);
  return out;
}

function decodeScaleName(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i] !== '!') {
      out += raw[i];
      continue;
    }
    const marker = raw[i + 1];
    const match = NAME_ESCAPES.find(([, escaped]) => escaped[1] === marker);
    if (match === undefined) {
      // An escape we do not recognise, from a hand-edited URL. Taking the
      // characters literally is better than dropping the name.
      out += raw[i];
      continue;
    }
    out += match[0];
    i += 1;
  }
  return out.slice(0, MAX_SCALE_NAME);
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
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
  // `Number('')` is 0, not NaN, so an empty segment would otherwise clamp to
  // the bottom of the range and read as a deliberate choice. A missing value
  // has to mean "use the default", or every URL stops being default.
  const parsed = raw === undefined || raw.trim() === '' ? Number.NaN : Number(raw);
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
