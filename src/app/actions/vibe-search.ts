'use server';

import {
  buildVibePrompt,
  offlineVibeFallback,
  parseGeminiVibeResponse,
  type VibeSearchTarget,
} from '@/lib/spectrum/vibe-search';
import { createRateLimiter } from '@/lib/spectrum/rate-limit';

/**
 * Server action for the Library's natural-language "vibe" search.
 *
 * The Gemini API key is read from a plain (non-`NEXT_PUBLIC_`) env var and
 * never leaves this server module — see rules/ecc/react/security.md's env
 * var table for why the prefix matters. Fails closed to the offline engine
 * on every failure mode (no key configured, network error, timeout,
 * non-2xx response, unparseable/invalid response, rate-limited) — a vibe
 * search must never surface a raw fetch error to the UI, since the whole
 * point of the offline fallback is that the feature keeps working either way.
 */

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_TIMEOUT_MS = 8000;

/** Conservative global cap protecting the free-tier quota — see
 *  rate-limit.ts for why this is a single-process, not distributed, limit. */
const MAX_GEMINI_CALLS_PER_WINDOW = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimiter = createRateLimiter(MAX_GEMINI_CALLS_PER_WINDOW, RATE_LIMIT_WINDOW_MS);
const GLOBAL_RATE_LIMIT_KEY = 'gemini-vibe-search';

interface GeminiResponseShape {
  readonly candidates?: readonly {
    readonly content?: {
      readonly parts?: readonly { readonly text?: string }[];
    };
  }[];
}

async function callGemini(query: string, apiKey: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildVibePrompt(query) }] }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const json = (await response.json()) as GeminiResponseShape;
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === 'string' ? text : null;
  } catch {
    // Network error, abort/timeout, or malformed JSON body — all treated
    // the same way: no usable text back, caller falls through to offline.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function vibeSearchAction(query: string): Promise<VibeSearchTarget> {
  const trimmed = query.trim();
  if (trimmed === '') return offlineVibeFallback(trimmed);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return offlineVibeFallback(trimmed);

  if (!rateLimiter.tryConsume(GLOBAL_RATE_LIMIT_KEY)) {
    return offlineVibeFallback(trimmed);
  }

  const rawText = await callGemini(trimmed, apiKey);
  if (rawText === null) return offlineVibeFallback(trimmed);

  const parsed = parseGeminiVibeResponse(rawText);
  return parsed ?? offlineVibeFallback(trimmed);
}
