import { describe, expect, it } from 'vitest';
import { ROOM_IDS } from '@/lib/nav/tabs';
import { CHANNEL_COUNT, resolveChannels } from '../drip';

/** Progress values swept across the whole scroll, plus both ends. */
const SWEEP = Array.from({ length: 41 }, (_, i) => i / 40);

describe('resolveChannels — shape', () => {
  it('returns one channel per room, in nav order', () => {
    expect(CHANNEL_COUNT).toBe(ROOM_IDS.length);
    expect(resolveChannels(0.5).map((c) => c.room)).toEqual([...ROOM_IDS]);
  });

  it('is deterministic', () => {
    for (const p of SWEEP) {
      expect(resolveChannels(p)).toEqual(resolveChannels(p));
    }
  });

  it('clamps anything the scroll could hand it', () => {
    for (const junk of [Number.NaN, -5, 12, Number.POSITIVE_INFINITY]) {
      expect(() => resolveChannels(junk)).not.toThrow();
      for (const channel of resolveChannels(junk)) {
        expect(channel.head).toBeGreaterThanOrEqual(0);
        expect(channel.head).toBeLessThanOrEqual(1);
        expect(channel.fill).toBeGreaterThanOrEqual(0);
        expect(channel.fill).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('resolveChannels — the fall', () => {
  it('starts with nothing fallen and nothing filled', () => {
    for (const channel of resolveChannels(0)) {
      expect(channel.head).toBe(0);
      expect(channel.fill).toBe(0);
      expect(channel.landed).toBe(false);
    }
  });

  it('ends with every stream landed and every pool full', () => {
    // The rooms must be fully painted by the time the section is done. A pool
    // still filling when the visitor has scrolled past is a pool they never
    // saw fill.
    for (const channel of resolveChannels(1)) {
      expect(channel.head).toBe(1);
      expect(channel.fill).toBe(1);
      expect(channel.landed).toBe(true);
    }
  });

  it('never runs backwards as you scroll down', () => {
    // Scroll is not guaranteed smooth — a flick, a scrollbar drag or a resize
    // can jump progress. Every quantity has to be a pure function of progress
    // that only ever advances, or the paint visibly un-falls.
    let previous = resolveChannels(0);
    for (const p of SWEEP.slice(1)) {
      const current = resolveChannels(p);
      current.forEach((channel, i) => {
        expect(channel.head).toBeGreaterThanOrEqual(previous[i]!.head - 1e-9);
        expect(channel.fill).toBeGreaterThanOrEqual(previous[i]!.fill - 1e-9);
      });
      previous = current;
    }
  });

  it('staggers the six rather than dropping them in lockstep', () => {
    // Six streams moving as one reads as a single wipe, not as six things.
    const heads = resolveChannels(0.45).map((c) => c.head);
    expect(new Set(heads.map((h) => h.toFixed(3))).size).toBeGreaterThan(1);
    expect(Math.max(...heads) - Math.min(...heads)).toBeGreaterThan(0.1);
  });

  it('accelerates — paint falls, it does not descend at a constant rate', () => {
    // Linear travel is the tell of an animation nobody thought about. Compare
    // distance covered in the first third of a channel's own fall against the
    // last third; gravity makes the second much larger.
    const channel = 0;
    const early = resolveChannels(0.3)[channel]!.head - resolveChannels(0.2)[channel]!.head;
    const late = resolveChannels(0.9)[channel]!.head - resolveChannels(0.8)[channel]!.head;
    expect(late).toBeGreaterThan(early);
  });
});

describe('resolveChannels — the landing', () => {
  it('does not fill a pool the paint has not reached yet', () => {
    for (const p of SWEEP) {
      for (const channel of resolveChannels(p)) {
        if (!channel.landed) expect(channel.fill).toBe(0);
      }
    }
  });

  it('marks landed exactly when the head arrives', () => {
    for (const p of SWEEP) {
      for (const channel of resolveChannels(p)) {
        expect(channel.landed).toBe(channel.head >= 1);
      }
    }
  });

  it('lets go of the stretch once the paint lands', () => {
    // A blob sitting in its pool should not still be elongated as though it
    // were mid-air — that is the detail that makes cheap 3D read as cheap.
    for (const channel of resolveChannels(1)) {
      expect(channel.stretch).toBeCloseTo(0, 6);
    }
  });

  it('stretches most in flight, not at either end', () => {
    const channel = 0;
    const atRest = resolveChannels(0)[channel]!.stretch;
    const inFlight = Math.max(...SWEEP.map((p) => resolveChannels(p)[channel]!.stretch));
    expect(atRest).toBeCloseTo(0, 6);
    expect(inFlight).toBeGreaterThan(0.2);
  });
});
