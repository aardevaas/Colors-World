import { describe, expect, it } from 'vitest';
import { contrastRatio, isInGamut, maxChroma, type Oklch } from '@/lib/color-engine';
import { CEILING_FRACTION, ROOM_LIGHTNESS, roomPalette } from '../room-palette';
import {
  QUIET_MIN_RATIO,
  TEXT_MIN_RATIO,
  roomTheme,
  solveForeground,
} from '../room-theme';

/**
 * Every hue, built exactly the way the shipping palette builds a room color.
 *
 * A flat `c: 0.12` was used here first and it put roughly a third of the hues
 * outside sRGB — the fixture failed the gamut assertion, not the solver. Taking
 * each hue to its own ceiling is both in-gamut by construction and the actual
 * input this code will see.
 */
const EVERY_HUE: readonly Oklch[] = Array.from({ length: 360 }, (_, h) => ({
  l: ROOM_LIGHTNESS,
  c: maxChroma(ROOM_LIGHTNESS, h, 'srgb') * CEILING_FRACTION,
  h,
}));

describe('solveForeground', () => {
  it('clears the target it was given, at every hue', () => {
    for (const bg of EVERY_HUE) {
      const fg = solveForeground(bg, TEXT_MIN_RATIO);
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(TEXT_MIN_RATIO);
    }
  });

  it('keeps the background hue, so the pair reads as one color', () => {
    for (const bg of EVERY_HUE) {
      expect(solveForeground(bg, TEXT_MIN_RATIO).h).toBe(bg.h);
    }
  });

  it('returns a color inside sRGB', () => {
    for (const bg of EVERY_HUE) {
      expect(isInGamut(solveForeground(bg, TEXT_MIN_RATIO), 'srgb')).toBe(true);
    }
  });

  it('picks the tonal answer rather than the extreme one', () => {
    // The point of the search. A pair solved to 4.5:1 against a mid-lightness
    // ground should land well inside the range, not at black or white — if it
    // ever collapses to an extreme the bands stop looking chosen.
    const bg: Oklch = { l: 0.68, c: 0.15, h: 250 };
    const fg = solveForeground(bg, TEXT_MIN_RATIO);

    expect(fg.l).toBeGreaterThan(0.02);
    expect(fg.c).toBeGreaterThan(0);
  });

  it('sits closer to the background when the target is relaxed', () => {
    for (const bg of EVERY_HUE) {
      const text = solveForeground(bg, TEXT_MIN_RATIO);
      const quiet = solveForeground(bg, QUIET_MIN_RATIO);

      expect(Math.abs(quiet.l - bg.l)).toBeLessThanOrEqual(Math.abs(text.l - bg.l));
    }
  });
});

describe('roomTheme', () => {
  it('clears the text target at rest, at every hue', () => {
    for (const bg of EVERY_HUE) {
      const theme = roomTheme(bg);
      expect(contrastRatio(theme.fg, theme.bg)).toBeGreaterThanOrEqual(TEXT_MIN_RATIO);
    }
  });

  it('clears the text target on hover too', () => {
    // The failure mode of hand-picked pairs: rest was checked, hover was not.
    for (const bg of EVERY_HUE) {
      const theme = roomTheme(bg);
      expect(contrastRatio(theme.fgHover, theme.bgHover)).toBeGreaterThanOrEqual(
        TEXT_MIN_RATIO
      );
    }
  });

  it('clears the quiet target for display type and marks', () => {
    for (const bg of EVERY_HUE) {
      const theme = roomTheme(bg);
      expect(contrastRatio(theme.fgQuiet, theme.bg)).toBeGreaterThanOrEqual(
        QUIET_MIN_RATIO
      );
    }
  });

  it('moves the background away from the foreground on hover', () => {
    // Hovering a link must never be the moment its label gets harder to read.
    //
    // Asserting `ratio(fgHover, bgHover) >= ratio(fg, bg)` was the obvious
    // test and it is the wrong one: fgHover is re-solved against the hovered
    // background and lands on whatever clears 4.5 closest, so the achieved
    // number can dip a hair below rest while still being safe. The mechanical
    // property that actually holds — and the one that matters — is that the
    // band itself deepens away from the type it is already carrying.
    for (const bg of EVERY_HUE) {
      const theme = roomTheme(bg);
      const rest = contrastRatio(theme.fg, theme.bg);
      const hovered = contrastRatio(theme.fg, theme.bgHover);

      expect(hovered).toBeGreaterThanOrEqual(rest);
    }
  });

  it('keeps every ink on one side of the band', () => {
    // A band must speak one color at two volumes. Solved freely, a magenta
    // ground came back with near-black body text and a near-white display
    // tone — both legible, together incoherent.
    for (const bg of EVERY_HUE) {
      const theme = roomTheme(bg);
      const side = Math.sign(theme.fg.l - bg.l);

      expect(Math.sign(theme.fgQuiet.l - bg.l)).toBe(side);
      expect(Math.sign(theme.fgHover.l - theme.bgHover.l)).toBe(side);
    }
  });

  it('speaks the quiet tone more quietly than the loud one', () => {
    for (const bg of EVERY_HUE) {
      const theme = roomTheme(bg);
      expect(contrastRatio(theme.fgQuiet, bg)).toBeLessThanOrEqual(
        contrastRatio(theme.fg, bg)
      );
    }
  });

  it('keeps both background states inside sRGB', () => {
    for (const bg of EVERY_HUE) {
      const theme = roomTheme(bg);
      expect(isInGamut(theme.bg, 'srgb')).toBe(true);
      expect(isInGamut(theme.bgHover, 'srgb')).toBe(true);
    }
  });

  it('holds for every seed the room palette can produce', () => {
    // The palette is generated per visit, so the guarantee has to survive any
    // seed rather than the one that happened to be checked.
    for (let seed = 0; seed < 360; seed += 7) {
      for (const room of roomPalette(seed)) {
        const theme = roomTheme(room.oklch);
        expect(contrastRatio(theme.fg, theme.bg)).toBeGreaterThanOrEqual(TEXT_MIN_RATIO);
        expect(contrastRatio(theme.fgHover, theme.bgHover)).toBeGreaterThanOrEqual(
          TEXT_MIN_RATIO
        );
      }
    }
  });
});
