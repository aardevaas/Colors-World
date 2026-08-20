import { describe, expect, it } from 'vitest';
import { contrastRatio, deltaEOk, isInGamut, maxChroma } from '@/lib/color-engine';
import { ROOM_IDS } from '@/lib/nav/tabs';
import {
  CEILING_FRACTION,
  PAGE_GROUND,
  ROOM_SEPARATION_FLOOR,
  roomPalette,
  seedHueFromRandom,
} from '../room-palette';

const SEEDS = [0, 37, 90, 180, 239.5, 300, 359.9];

describe('roomPalette — one colour per room', () => {
  it('always returns exactly one colour for every room, in nav order', () => {
    for (const seed of SEEDS) {
      const palette = roomPalette(seed);
      expect(palette.map((entry) => entry.room)).toEqual([...ROOM_IDS]);
    }
  });

  it('is deterministic — the same seed always paints the same rooms', () => {
    for (const seed of SEEDS) {
      expect(roomPalette(seed)).toEqual(roomPalette(seed));
    }
  });

  it('survives any number the caller could hand it', () => {
    for (const junk of [Number.NaN, Number.POSITIVE_INFINITY, -720, 1e9]) {
      expect(() => roomPalette(junk)).not.toThrow();
      expect(roomPalette(junk)).toHaveLength(ROOM_IDS.length);
    }
  });
});

describe('roomPalette — six rooms have to be six colours', () => {
  it('keeps every pair visibly apart', () => {
    // Six streams of paint that a visitor cannot tell apart is five rooms
    // wearing a disguise. This is the property the whole layout depends on.
    for (const seed of SEEDS) {
      const palette = roomPalette(seed);
      for (let i = 0; i < palette.length; i += 1) {
        for (let j = i + 1; j < palette.length; j += 1) {
          const distance = deltaEOk(palette[i]!.oklch, palette[j]!.oklch);
          expect(distance).toBeGreaterThanOrEqual(ROOM_SEPARATION_FLOOR);
        }
      }
    }
  });

  it('spaces the hues evenly, whatever the seed', () => {
    // Even spacing is what guarantees the separation above for every seed
    // rather than for the seeds that happen to work.
    const spacing = 360 / ROOM_IDS.length;
    for (const seed of SEEDS) {
      const hues = roomPalette(seed).map((entry) => entry.oklch.h);
      for (let i = 1; i < hues.length; i += 1) {
        const gap = (hues[i]! - hues[i - 1]! + 360) % 360;
        expect(gap).toBeCloseTo(spacing, 4);
      }
    }
  });

  it('rotates the whole set when the seed rotates', () => {
    const base = roomPalette(0);
    const turned = roomPalette(60);
    // 60 degrees is exactly one room's worth of hue, so room n should land on
    // where room n-1 was. If it does not, the spacing is not what it claims.
    for (let i = 1; i < base.length; i += 1) {
      expect(turned[i - 1]!.oklch.h).toBeCloseTo(base[i]!.oklch.h, 4);
    }
  });
});

describe('roomPalette — the gamut ceiling is the point', () => {
  it('renders every colour inside sRGB', () => {
    for (const seed of SEEDS) {
      for (const entry of roomPalette(seed)) {
        expect(isInGamut(entry.oklch, 'srgb')).toBe(true);
      }
    }
  });

  it('pushes each hue to its own ceiling rather than to a shared chroma', () => {
    // This is the engine's actual claim, doing actual work: reachable chroma
    // varies almost threefold across the wheel, so six hues at one fixed
    // chroma means the ones with headroom look timid and the ones without get
    // clipped. Each is taken to the same fraction of *its own* ceiling, so
    // the six read as equally committed instead of arbitrarily uneven.
    for (const seed of SEEDS) {
      for (const entry of roomPalette(seed)) {
        const ceiling = maxChroma(entry.oklch.l, entry.oklch.h, 'srgb');
        expect(entry.oklch.c).toBeCloseTo(ceiling * CEILING_FRACTION, 5);
      }
    }
  });

  it('proves the ceiling actually varies — otherwise the claim is empty', () => {
    // Guards the reasoning above, not the code: if every hue had the same
    // ceiling, taking each to its own would be an elaborate way of writing a
    // constant, and the comment would be a lie.
    const chromas = roomPalette(0).map((entry) => entry.oklch.c);
    expect(Math.max(...chromas) / Math.min(...chromas)).toBeGreaterThan(1.5);
  });
});

describe('roomPalette — it has to survive being on the page', () => {
  it('clears 3:1 against the page ground, so a pool has a visible edge', () => {
    for (const seed of SEEDS) {
      for (const entry of roomPalette(seed)) {
        expect(contrastRatio(entry.oklch, PAGE_GROUND)).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('emits a hex the DOM can use directly', () => {
    for (const entry of roomPalette(0)) {
      expect(entry.hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('seedHueFromRandom', () => {
  it('maps the unit interval onto the wheel', () => {
    expect(seedHueFromRandom(0)).toBe(0);
    expect(seedHueFromRandom(0.5)).toBeCloseTo(180, 6);
    expect(seedHueFromRandom(0.999999)).toBeLessThan(360);
  });

  it('never produces a hue the palette cannot use', () => {
    for (const junk of [Number.NaN, -1, 2, Number.POSITIVE_INFINITY]) {
      const hue = seedHueFromRandom(junk);
      expect(Number.isFinite(hue)).toBe(true);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });
});
