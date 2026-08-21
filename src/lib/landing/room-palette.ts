/**
 * Six rooms, six colors, generated rather than branded.
 *
 * The landing page pours six streams of paint out of the hero, one into each
 * room. Those six could have been picked once and written down — but a color
 * tool whose own landing page ships a hardcoded palette is arguing against
 * itself. These are generated per visit, which means every visitor sees a
 * different six and the page is a live output of the engine rather than a
 * screenshot of one.
 *
 * ## Why the ceiling, and not a harmony
 *
 * A harmony rule is the wrong tool here. Harmonies make colors *relate*, and
 * six related colors are harder to tell apart — the opposite of what six room
 * identities need. So the hues are spread evenly, which maximises mutual
 * separation by construction.
 *
 * The real work is what happens next. Reachable chroma varies by roughly three
 * times across the hue wheel, so six evenly-spaced hues at one fixed chroma
 * come out visibly uneven: the hues with headroom look timid, and the ones
 * without get clipped to something muddier than asked for. Each hue is instead
 * taken to the same fraction of *its own* ceiling, so the set reads as equally
 * committed. That is the engine's central claim doing visible work on the page
 * that makes the claim.
 *
 * Pure: no DOM, no React, no randomness of its own — the caller supplies the
 * seed, so a given visit is reproducible and shareable.
 */

import {
  formatHex,
  isInGamut,
  mapToGamut,
  maxChroma,
  type Oklch,
} from '@/lib/color-engine';
import { ROOM_IDS, type TabId } from '@/lib/nav/tabs';

/**
 * How much of each hue's own ceiling to use. Just short of 1: sitting exactly
 * on the hull round-trips through 8-bit hex landing a hair outside it, and a
 * color that reports out-of-gamut on a page about gamut is not a good look.
 */
export const CEILING_FRACTION = 0.92;

/**
 * Lightness every room color sits at. Mid-high: dark enough to hold white
 * text nowhere near it, light enough to read as wet paint against the near
 * black page rather than as a stain.
 */
export const ROOM_LIGHTNESS = 0.68;

/** The page these pools sit on, for the contrast guarantee below. */
export const PAGE_GROUND: Oklch = { l: 0.15, c: 0.006, h: 286 };

/**
 * The least two room colors may resemble each other. Comfortably above the
 * 0.04 just-noticeable-difference the rest of the app uses — two rooms are not
 * two scale steps, and "technically distinguishable" is not the bar when the
 * color is the room's identity.
 */
export const ROOM_SEPARATION_FLOOR = 0.12;

export interface RoomColor {
  readonly room: TabId;
  readonly hex: string;
  readonly oklch: Oklch;
}

export function roomPalette(seedHue: number): readonly RoomColor[] {
  const seed = normaliseHue(seedHue);
  const spacing = 360 / ROOM_IDS.length;

  return ROOM_IDS.map((room, index) => {
    const hue = normaliseHue(seed + index * spacing);
    const oklch = atCeiling(ROOM_LIGHTNESS, hue);
    return { room, hex: formatHex(oklch), oklch };
  });
}

/** A hue from a unit-interval random number, guarding whatever it is handed —
 *  `Math.random()` is trustworthy, a value plucked out of a URL is not. */
export function seedHueFromRandom(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const clamped = Math.min(0.9999999, Math.max(0, value));
  return clamped * 360;
}

function atCeiling(lightness: number, hue: number): Oklch {
  const candidate: Oklch = {
    l: lightness,
    c: maxChroma(lightness, hue, 'srgb') * CEILING_FRACTION,
    h: hue,
  };
  // The fraction should already keep this inside the hull; mapping is the
  // belt-and-braces for hues where the ceiling solver lands a hair optimistic.
  return isInGamut(candidate, 'srgb') ? candidate : mapToGamut(candidate, 'srgb').oklch;
}

function normaliseHue(hue: number): number {
  if (!Number.isFinite(hue)) return 0;
  return ((hue % 360) + 360) % 360;
}
