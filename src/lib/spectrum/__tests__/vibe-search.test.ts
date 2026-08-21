import { describe, expect, it } from 'vitest';
import {
  buildVibePrompt,
  offlineVibeFallback,
  parseGeminiVibeResponse,
} from '../vibe-search';

describe('buildVibePrompt', () => {
  it('includes the user query verbatim', () => {
    const prompt = buildVibePrompt('cyberpunk Tokyo alleyway at night');
    expect(prompt).toContain('cyberpunk Tokyo alleyway at night');
  });

  it('instructs the model to respond with raw JSON, not markdown', () => {
    const prompt = buildVibePrompt('warm latte');
    expect(prompt.toLowerCase()).toContain('no markdown');
  });
});

describe('parseGeminiVibeResponse', () => {
  it('parses a well-formed response', () => {
    const raw = JSON.stringify({
      hue: 200,
      lightness: 0.6,
      chroma: 0.15,
      hueSpread: 25,
      rationale: 'A cool, clear blue.',
    });
    const result = parseGeminiVibeResponse(raw);
    expect(result).not.toBeNull();
    expect(result?.seed).toEqual({ l: 0.6, c: 0.15, h: 200 });
    expect(result?.source).toBe('gemini');
    expect(result?.rationale).toBe('A cool, clear blue.');
  });

  it('strips a markdown code fence the model added despite instructions', () => {
    const raw =
      '```json\n' +
      JSON.stringify({ hue: 100, lightness: 0.5, chroma: 0.1, hueSpread: 20, rationale: 'ok' }) +
      '\n```';
    const result = parseGeminiVibeResponse(raw);
    expect(result).not.toBeNull();
    expect(result?.seed.h).toBe(100);
  });

  it('returns null for unparseable JSON', () => {
    expect(parseGeminiVibeResponse('not json at all')).toBeNull();
  });

  it('returns null when a required field is missing', () => {
    const raw = JSON.stringify({ hue: 100, lightness: 0.5, chroma: 0.1 });
    expect(parseGeminiVibeResponse(raw)).toBeNull();
  });

  it('returns null when rationale is missing or empty', () => {
    const raw = JSON.stringify({ hue: 100, lightness: 0.5, chroma: 0.1, hueSpread: 20, rationale: '' });
    expect(parseGeminiVibeResponse(raw)).toBeNull();
  });

  it('normalizes an out-of-range hue into 0-360', () => {
    const raw = JSON.stringify({
      hue: 370,
      lightness: 0.5,
      chroma: 0.1,
      hueSpread: 20,
      rationale: 'x',
    });
    const result = parseGeminiVibeResponse(raw);
    expect(result?.seed.h).toBe(10);
  });

  it('clamps an out-of-range lightness/chroma/hueSpread rather than passing through', () => {
    const raw = JSON.stringify({
      hue: 100,
      lightness: 5,
      chroma: 999,
      hueSpread: 500,
      rationale: 'x',
    });
    const result = parseGeminiVibeResponse(raw);
    expect(result?.seed.l).toBeLessThanOrEqual(1);
    expect(result?.seed.c).toBeLessThanOrEqual(0.4);
    expect(result?.hueSpread).toBeLessThanOrEqual(90);
  });
});

describe('offlineVibeFallback', () => {
  it('matches a single color keyword', () => {
    // Deliberately just the one keyword — "warm and matcha-like" would also
    // match "warm" and pull the circular mean toward it, which isn't what
    // this test is isolating.
    const result = offlineVibeFallback('a matcha-like tone');
    expect(result.source).toBe('offline-fallback');
    // matcha biases toward a green hue in the 120-150 range
    expect(result.seed.h).toBeGreaterThan(90);
    expect(result.seed.h).toBeLessThan(180);
  });

  it('averages multiple matched keywords', () => {
    const result = offlineVibeFallback('dark and vivid');
    expect(result.seed.l).toBeLessThan(0.5); // "dark" pulls lightness down
    expect(result.seed.c).toBeGreaterThan(0.1); // "vivid" pulls chroma up
  });

  it('averages hue circularly rather than arithmetically across the 360/0 seam', () => {
    // "rose" (~355°) and "red" (~10°) arithmetically average to ~182 (a
    // teal!) but circularly should land near the 0/360 seam instead.
    const result = offlineVibeFallback('rose and red');
    const distanceFromZero = Math.min(result.seed.h, 360 - result.seed.h);
    expect(distanceFromZero).toBeLessThan(30);
  });

  it('is case-insensitive', () => {
    const lower = offlineVibeFallback('cyberpunk');
    const upper = offlineVibeFallback('CYBERPUNK');
    expect(lower.seed).toEqual(upper.seed);
  });

  it('returns an honest neutral result when no keyword matches at all', () => {
    const result = offlineVibeFallback('xyzzy qwerty asdf');
    expect(result.source).toBe('offline-fallback');
    expect(result.rationale.toLowerCase()).toContain('no recognised');
    expect(result.seed.c).toBeLessThan(0.1); // neutral, not an arbitrary vivid hue
  });

  it('never throws on empty input', () => {
    expect(() => offlineVibeFallback('')).not.toThrow();
  });
});
