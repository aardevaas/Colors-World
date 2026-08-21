import type { Oklch } from '@/lib/color-engine';

/**
 * Natural-language "vibe" search — turns a free-text prompt ("cyberpunk
 * Tokyo alleyway at night") into a target region of OKLCH space to search
 * against, rather than a single exact color (nobody means one exact hex
 * when they type a mood).
 *
 * Kept pure and dependency-free on purpose: the actual Gemini network call
 * lives in the server action that wraps this (src/app/actions.ts), not
 * here, so the prompt construction, response parsing, and offline fallback
 * — the parts with real logic worth getting right — can be unit tested
 * without a network boundary.
 */

export interface VibeSearchTarget {
  readonly seed: Oklch;
  readonly lightnessRange: readonly [number, number];
  readonly chromaRange: readonly [number, number];
  /** Degrees either side of seed.h — not a min/max pair, since hue search
   *  ranges need to wrap cleanly through the 360/0 seam. */
  readonly hueSpread: number;
  readonly source: 'gemini' | 'offline-fallback';
  readonly rationale: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function buildVibePrompt(query: string): string {
  return [
    'You are a color-space assistant for a design tool. A user typed a',
    'free-text description of a mood, scene, or vibe, and you must translate',
    'it into target OKLCH color coordinates.',
    '',
    `User input: "${query.trim()}"`,
    '',
    'Respond with ONLY raw JSON (no markdown code fences, no commentary,',
    'no explanation outside the JSON) matching exactly this shape:',
    '{"hue": <number 0-360>, "lightness": <number 0-1>, "chroma": <number 0-0.37>, "hueSpread": <number 10-60>, "rationale": "<one short sentence>"}',
    '',
    '"hue" is the OKLCH hue angle that best represents the vibe.',
    '"lightness" is OKLCH lightness (0 = black, 1 = white) that best fits the mood.',
    '"chroma" is OKLCH chroma/saturation (0 = grey, ~0.37 = maximally vivid) that fits the intensity of the vibe.',
    '"hueSpread" is how many degrees either side of "hue" still fit the vibe — a narrow, specific vibe should be small (10-20), a broad one large (40-60).',
    '"rationale" is a single short sentence explaining the color choice, written for the end user.',
  ].join('\n');
}

interface RawGeminiVibeShape {
  readonly hue: unknown;
  readonly lightness: unknown;
  readonly chroma: unknown;
  readonly hueSpread: unknown;
  readonly rationale: unknown;
}

/** Gemini is instructed not to wrap its answer in a markdown code fence, but
 *  models do this anyway often enough that stripping it defensively is
 *  worth the few lines — silently returning null over a fence the model
 *  added despite instructions would make the fallback fire far more than
 *  the underlying translation quality actually warrants. */
function stripMarkdownFence(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return fenced ? fenced[1]!.trim() : trimmed;
}

/**
 * Parses and validates Gemini's raw text response. Returns `null` for
 * anything that isn't the exact expected shape — the caller falls back to
 * the offline engine rather than trust a malformed or hallucinated response,
 * since an out-of-range hue/lightness/chroma would otherwise silently
 * produce a nonsensical search region.
 */
export function parseGeminiVibeResponse(rawText: string): VibeSearchTarget | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripMarkdownFence(rawText));
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const shape = parsed as RawGeminiVibeShape;

  const hue = Number(shape.hue);
  const lightness = Number(shape.lightness);
  const chroma = Number(shape.chroma);
  const hueSpread = Number(shape.hueSpread);
  const rationale = typeof shape.rationale === 'string' ? shape.rationale : '';

  if (
    !Number.isFinite(hue) ||
    !Number.isFinite(lightness) ||
    !Number.isFinite(chroma) ||
    !Number.isFinite(hueSpread) ||
    rationale === ''
  ) {
    return null;
  }

  const normalizedHue = ((hue % 360) + 360) % 360;

  return {
    seed: { l: clamp(lightness, 0, 1), c: clamp(chroma, 0, 0.4), h: normalizedHue },
    lightnessRange: [clamp(lightness - 0.15, 0, 1), clamp(lightness + 0.15, 0, 1)],
    chromaRange: [clamp(chroma - 0.06, 0, 0.4), clamp(chroma + 0.06, 0, 0.4)],
    hueSpread: clamp(hueSpread, 5, 90),
    source: 'gemini',
    rationale,
  };
}

/**
 * Keyword-weighted offline fallback, used whenever Gemini isn't configured,
 * times out, rate-limits, or returns something unparseable. Every matched
 * keyword contributes an equal-weighted vote toward a hue/lightness/chroma
 * bias; unmatched input (a prompt with none of these words) still returns a
 * usable, honestly-labelled result rather than throwing — a neutral mid-tone
 * with a rationale that says as much.
 */
interface KeywordBias {
  readonly hue?: number;
  readonly lightness?: number;
  readonly chroma?: number;
}

const KEYWORD_BIASES: Record<string, KeywordBias> = {
  // Hue-naming words
  red: { hue: 10 }, crimson: { hue: 10, lightness: 0.35 },
  orange: { hue: 40 },
  amber: { hue: 60, lightness: 0.6 },
  yellow: { hue: 95 },
  gold: { hue: 80, lightness: 0.7, chroma: 0.15 },
  green: { hue: 140 },
  matcha: { hue: 130, lightness: 0.65, chroma: 0.1 },
  mint: { hue: 165, lightness: 0.85, chroma: 0.08 },
  teal: { hue: 175 },
  cyan: { hue: 200 },
  ocean: { hue: 210, lightness: 0.45 },
  blue: { hue: 235 },
  navy: { hue: 250, lightness: 0.25 },
  violet: { hue: 275 },
  lavender: { hue: 285, lightness: 0.82, chroma: 0.06 },
  purple: { hue: 300 },
  magenta: { hue: 325 },
  pink: { hue: 350, lightness: 0.8, chroma: 0.1 },
  rose: { hue: 355, lightness: 0.65 },
  coral: { hue: 25, lightness: 0.7, chroma: 0.15 },
  rust: { hue: 35, lightness: 0.4, chroma: 0.12 },
  brown: { hue: 55, lightness: 0.35, chroma: 0.08 },
  cream: { hue: 75, lightness: 0.9, chroma: 0.03 },
  latte: { hue: 65, lightness: 0.72, chroma: 0.05 },

  // Temperature words
  warm: { hue: 40 },
  hot: { hue: 20, lightness: 0.5, chroma: 0.2 },
  cool: { hue: 220 },
  cold: { hue: 220, lightness: 0.6, chroma: 0.08 },
  icy: { hue: 210, lightness: 0.9, chroma: 0.05 },

  // Lightness words
  dark: { lightness: 0.2 },
  night: { lightness: 0.15 },
  midnight: { lightness: 0.1, hue: 250 },
  shadow: { lightness: 0.18 },
  light: { lightness: 0.85 },
  bright: { lightness: 0.8, chroma: 0.2 },
  pale: { lightness: 0.88, chroma: 0.04 },
  deep: { lightness: 0.3 },
  sunny: { lightness: 0.8, hue: 85, chroma: 0.15 },

  // Saturation/intensity words
  vivid: { chroma: 0.28 },
  neon: { chroma: 0.35, lightness: 0.65 },
  bold: { chroma: 0.22 },
  cyberpunk: { chroma: 0.32, hue: 310, lightness: 0.4 },
  muted: { chroma: 0.05 },
  soft: { chroma: 0.06, lightness: 0.75 },
  pastel: { chroma: 0.07, lightness: 0.85 },
  dusty: { chroma: 0.05, lightness: 0.6 },
  subtle: { chroma: 0.04 },
};

/** Neutral, deliberately unremarkable starting point when no keyword in
 *  the prompt matches anything — a mid-grey-ish tone rather than an
 *  arbitrary hue, so an unmatched prompt reads as "we don't know" rather
 *  than "we quietly guessed." */
const NO_MATCH_SEED: Oklch = { l: 0.6, c: 0.03, h: 0 };

export function offlineVibeFallback(query: string): VibeSearchTarget {
  const words = query.toLowerCase().match(/[a-z]+/g) ?? [];
  const matches = words
    .map((word) => KEYWORD_BIASES[word])
    .filter((bias): bias is KeywordBias => bias !== undefined);

  if (matches.length === 0) {
    return {
      seed: NO_MATCH_SEED,
      lightnessRange: [0.4, 0.8],
      chromaRange: [0, 0.1],
      hueSpread: 90,
      source: 'offline-fallback',
      rationale:
        "No recognised color/mood keywords in that phrase, so this shows a broad neutral range rather than guessing a specific hue.",
    };
  }

  const hues = matches.filter((m) => m.hue !== undefined).map((m) => m.hue!);
  const lightnesses = matches.filter((m) => m.lightness !== undefined).map((m) => m.lightness!);
  const chromas = matches.filter((m) => m.chroma !== undefined).map((m) => m.chroma!);

  // Hues average circularly (via sin/cos) — a plain mean of e.g. 350° and
  // 10° would wrongly land on 180° instead of 0°/360°.
  const hue =
    hues.length > 0
      ? circularMeanDegrees(hues)
      : NO_MATCH_SEED.h;
  const lightness =
    lightnesses.length > 0
      ? lightnesses.reduce((sum, v) => sum + v, 0) / lightnesses.length
      : NO_MATCH_SEED.l;
  const chroma =
    chromas.length > 0
      ? chromas.reduce((sum, v) => sum + v, 0) / chromas.length
      : NO_MATCH_SEED.c;

  return {
    seed: { l: clamp(lightness, 0, 1), c: clamp(chroma, 0, 0.4), h: hue },
    lightnessRange: [clamp(lightness - 0.18, 0, 1), clamp(lightness + 0.18, 0, 1)],
    chromaRange: [clamp(chroma - 0.08, 0, 0.4), clamp(chroma + 0.08, 0, 0.4)],
    hueSpread: hues.length > 0 ? 30 : 90,
    source: 'offline-fallback',
    rationale: `Matched ${matches.length} color/mood ${matches.length === 1 ? 'word' : 'words'} in that phrase using the offline fallback engine (Gemini unavailable or not configured).`,
  };
}

function circularMeanDegrees(degrees: readonly number[]): number {
  const radians = degrees.map((d) => (d * Math.PI) / 180);
  const sinSum = radians.reduce((sum, r) => sum + Math.sin(r), 0);
  const cosSum = radians.reduce((sum, r) => sum + Math.cos(r), 0);
  const meanRadians = Math.atan2(sinSum / radians.length, cosSum / radians.length);
  const meanDegrees = (meanRadians * 180) / Math.PI;
  return ((meanDegrees % 360) + 360) % 360;
}
