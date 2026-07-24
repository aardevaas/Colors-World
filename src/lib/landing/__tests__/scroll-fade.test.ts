import { describe, expect, test } from 'vitest';
import {
  COPY_FADE_END,
  COPY_FADE_START,
  fadeOut,
  resolveHudFade,
} from '../scroll-fade';

/** Mirrors ParticleStorm — the copy must be gone before the shell closes. */
const MORPH_START = 0.42;
const MORPH_END = 0.88;

describe('fadeOut', () => {
  test('holds at 1 before the window and 0 after it', () => {
    expect(fadeOut(0, 0.3, 0.5)).toBe(1);
    expect(fadeOut(0.3, 0.3, 0.5)).toBe(1);
    expect(fadeOut(0.5, 0.3, 0.5)).toBe(0);
    expect(fadeOut(1, 0.3, 0.5)).toBe(0);
  });

  test('is linear across the window', () => {
    expect(fadeOut(0.4, 0.3, 0.5)).toBeCloseTo(0.5, 6);
    expect(fadeOut(0.35, 0.3, 0.5)).toBeCloseTo(0.75, 6);
    expect(fadeOut(0.45, 0.3, 0.5)).toBeCloseTo(0.25, 6);
  });

  test('never leaves 0..1, and decreases monotonically', () => {
    let previous = Infinity;
    for (let value = 0; value <= 1.0001; value += 0.01) {
      const opacity = fadeOut(value, 0.3, 0.5);
      expect(opacity).toBeGreaterThanOrEqual(0);
      expect(opacity).toBeLessThanOrEqual(1);
      expect(opacity).toBeLessThanOrEqual(previous + 1e-9);
      previous = opacity;
    }
  });

  test('a zero-width window degrades to a hard switch rather than dividing by zero', () => {
    expect(fadeOut(0.2, 0.5, 0.5)).toBe(1);
    expect(fadeOut(0.5, 0.5, 0.5)).toBe(0);
    expect(Number.isNaN(fadeOut(0.5, 0.5, 0.5))).toBe(false);
  });
});

describe('resolveHudFade', () => {
  test('hero copy is fully visible at rest', () => {
    const fade = resolveHudFade(0);
    expect(fade.copyOpacity).toBe(1);
    expect(fade.cueOpacity).toBe(1);
    expect(fade.copyPointerEvents).toBe('auto');
  });

  test('copy cross-dissolves with the gather rather than cutting before it', () => {
    // The brief is "fade away *as* the sphere creates itself", so a short
    // overlap is intended — the text should still be going when the globe
    // starts, but already faint, and fully gone long before it closes.
    const atGatherStart = resolveHudFade(MORPH_START).copyOpacity;
    expect(atGatherStart).toBeGreaterThan(0);
    expect(atGatherStart).toBeLessThan(0.45);
    expect(COPY_FADE_END).toBeLessThan(MORPH_END);
    expect(resolveHudFade(COPY_FADE_END).copyOpacity).toBe(0);
    expect(resolveHudFade(MORPH_END).copyOpacity).toBe(0);
  });

  test('copy starts fading before it is asked to disappear', () => {
    expect(COPY_FADE_START).toBeGreaterThan(0.1);
    expect(COPY_FADE_START).toBeLessThan(COPY_FADE_END);
    const midway = resolveHudFade((COPY_FADE_START + COPY_FADE_END) / 2);
    expect(midway.copyOpacity).toBeGreaterThan(0.3);
    expect(midway.copyOpacity).toBeLessThan(0.7);
  });

  test('the scroll cue clears well before the copy does', () => {
    expect(resolveHudFade(0.2).cueOpacity).toBe(0);
    expect(resolveHudFade(0.2).copyOpacity).toBe(1);
  });

  test('copy stops catching clicks once it is too faint to see', () => {
    // Still clearly visible -> must stay clickable.
    expect(resolveHudFade(0.3).copyPointerEvents).toBe('auto');
    expect(resolveHudFade(MORPH_START).copyPointerEvents).toBe('auto');
    // Effectively invisible -> must not swallow clicks aimed at the globe.
    expect(resolveHudFade(COPY_FADE_END).copyPointerEvents).toBe('none');
    expect(resolveHudFade(MORPH_END).copyPointerEvents).toBe('none');
  });
});
