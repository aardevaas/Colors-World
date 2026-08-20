/**
 * Six streams of paint leaving the hero, one per room.
 *
 * The whole scroll story in one pure function: given how far down the section
 * a visitor is, where is each stream, how elongated is it, and how full is the
 * pool it is falling into. Nothing here knows about WebGL, the DOM, or time —
 * everything is a function of scroll position alone.
 *
 * That is deliberate rather than tidy. Scroll is not smooth: a trackpad flick,
 * a scrollbar drag, a resize or a restored position on reload all jump it, and
 * anything that integrates velocity frame by frame drifts out of step with the
 * page the moment one of those happens. Deriving every quantity from position
 * means the paint is always exactly where the scrollbar says it should be, and
 * it can never run backwards or accumulate error.
 *
 * Pure: no DOM, no React, no clock.
 */

import { ROOM_IDS, type TabId } from '@/lib/nav/tabs';

export const CHANNEL_COUNT = ROOM_IDS.length;

/**
 * The latest a stream may begin falling, as a fraction of the scroll. Six
 * streams starting together read as one wipe rather than as six things, so
 * they are spread across the first part of the section — but not so far that
 * the last one is still in the air when the visitor has scrolled past.
 */
const LAST_DEPARTURE = 0.34;

/** How much of a channel's own fall is spent filling its pool afterwards. */
const FILL_SHARE = 0.3;

export interface Channel {
  readonly room: TabId;
  /** 0 at the hero, 1 in the pool. */
  readonly head: number;
  /** How elongated the falling blob is — 0 at rest, peaking mid-flight. */
  readonly stretch: number;
  readonly landed: boolean;
  /** How full this room's pool is, 0 until the paint arrives. */
  readonly fill: number;
}

export function resolveChannels(progress: number): readonly Channel[] {
  const p = clamp01(progress);

  return ROOM_IDS.map((room, index) => {
    const departure = departureOf(index);
    // Each channel runs its own 0..1 clock between leaving and the end of the
    // section, so however late it departs it still lands by the time the
    // section is done.
    const local = clamp01((p - departure) / Math.max(1e-6, 1 - departure));

    // Falling accelerates: distance under gravity goes with the square of
    // time. The fill takes the tail of the same clock, so a stream that leaves
    // late also finishes filling late, and the six pools complete in the order
    // they were fed.
    const flight = clamp01(local / (1 - FILL_SHARE));
    const head = flight * flight;
    const landed = head >= 1;

    return {
      room,
      head,
      stretch: landed ? 0 : stretchAt(flight),
      landed,
      fill: landed ? clamp01((local - (1 - FILL_SHARE)) / FILL_SHARE) : 0,
    };
  });
}

/**
 * When each stream leaves, spread across the departure window.
 *
 * Deliberately not evenly spaced and not random: the middle two leave first
 * and the outer ones trail, which reads as the word shedding paint from its
 * centre rather than as a queue emptying left to right. Deterministic, so the
 * same scroll position always looks the same.
 */
function departureOf(index: number): number {
  const centre = (CHANNEL_COUNT - 1) / 2;
  const distanceFromCentre = Math.abs(index - centre) / centre;
  return distanceFromCentre * LAST_DEPARTURE;
}

/**
 * A falling blob elongates as it accelerates and snaps back as it lands.
 * Peaks around two-thirds of the way down — the point where it is quickest but
 * has not yet begun to gather itself for the impact.
 */
function stretchAt(flight: number): number {
  return Math.sin(clamp01(flight) * Math.PI) ** 0.7;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
