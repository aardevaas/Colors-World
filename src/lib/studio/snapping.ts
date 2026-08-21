/**
 * Pure geometry for the Studio canvas's two snap behaviours — no DOM, no
 * React, no camera import (thresholds are passed in already converted to
 * world units by the caller, which is the one place that knows the current
 * zoom). Everything here operates on plain rects in WORLD coordinates.
 *
 * Two distinct behaviours, checked in priority order:
 *
 * 1. Editorial palette docking — a color-bearing card (color/palette/
 *    gradient) dragged near an IMAGE card slots into an aligned bar along
 *    that image's nearest edge. This is the signature interaction, so it
 *    takes priority over generic bento snapping when both are in range.
 * 2. Bento grid snap — any card dragged near any other card aligns to a
 *    uniform 12px gap and/or a shared center line.
 */

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SnapCandidate extends Rect {
  readonly id: string;
  /** color/palette/gradient cards each have one representative hex and are
   *  eligible to dock onto an image's edge — decoupled from the full
   *  BoardCard kind union so this module has no dependency on UI types. */
  readonly isColorBearing: boolean;
  readonly isImage: boolean;
}

export type SnapKind = 'image-dock' | 'bento' | null;

export interface AlignmentGuide {
  readonly axis: 'x' | 'y';
  /** World-space coordinate of the guide line along its own axis. */
  readonly position: number;
  /** World-space span the guide is drawn across, on the other axis. */
  readonly start: number;
  readonly end: number;
}

export interface SnapResult {
  readonly x: number;
  readonly y: number;
  readonly snapped: boolean;
  readonly snapKind: SnapKind;
  readonly guides: readonly AlignmentGuide[];
  /** The image a color card docked to, when snapKind is 'image-dock'. */
  readonly dockedToId: string | null;
}

/** Uniform gap the spec asks for, in both bento clusters and palette docks. */
export const BENTO_GAP = 12;

/** Screen-space thresholds — converted to world units by the caller
 *  (divide by camera zoom) before calling findSnap. Keeping the *authored*
 *  threshold in screen px is what a designer actually asked for: "within
 *  20px" means 20px on the glass, not 20 world units that shrink to
 *  nothing when zoomed out or become hair-triggered zoomed in. */
export const BENTO_SNAP_THRESHOLD_SCREEN_PX = 8;
export const IMAGE_DOCK_THRESHOLD_SCREEN_PX = 20;

/** Docked-card position tolerance, world units — used only to recognise an
 *  already-docked neighbour so a newly-docked card lines up after it
 *  instead of overlapping it. */
const DOCK_ALIGNMENT_EPSILON = 2;

function rectGap(a: Rect, b: Rect): number {
  const dx = Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width), 0);
  const dy = Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height), 0);
  return Math.sqrt(dx * dx + dy * dy);
}

type Edge = 'left' | 'right' | 'top' | 'bottom';

/** Which edge of `target` the dragged rect's center is closest to,
 *  normalized by target's half-extents so a wide image doesn't always
 *  win left/right over top/bottom. */
function nearestEdge(dragged: Rect, target: Rect): Edge {
  const dx = dragged.x + dragged.width / 2 - (target.x + target.width / 2);
  const dy = dragged.y + dragged.height / 2 - (target.y + target.height / 2);
  const nx = dx / (target.width / 2);
  const ny = dy / (target.height / 2);
  if (Math.abs(nx) > Math.abs(ny)) return nx > 0 ? 'right' : 'left';
  return ny > 0 ? 'bottom' : 'top';
}

/** How many other color-bearing cards are already docked to this edge of
 *  this image, so a newly-docked card lines up after them rather than on
 *  top of them. Recognised by position, not a stored relationship — the
 *  outward-facing coordinate matches the dock formula within a small
 *  tolerance. */
function countAlreadyDocked(
  target: Rect,
  edge: Edge,
  others: readonly SnapCandidate[],
  excludeId: string
): number {
  const expectedOuter =
    edge === 'left'
      ? target.x - BENTO_GAP
      : edge === 'right'
        ? target.x + target.width + BENTO_GAP
        : edge === 'top'
          ? target.y - BENTO_GAP
          : target.y + target.height + BENTO_GAP;

  return others.filter((candidate) => {
    if (candidate.id === excludeId || !candidate.isColorBearing) return false;
    const outer =
      edge === 'left'
        ? candidate.x + candidate.width
        : edge === 'right'
          ? candidate.x
          : edge === 'top'
            ? candidate.y + candidate.height
            : candidate.y;
    return Math.abs(outer - expectedOuter) <= DOCK_ALIGNMENT_EPSILON;
  }).length;
}

function dockPosition(dragged: Rect, target: Rect, edge: Edge, dockedCount: number): { x: number; y: number } {
  const stackOffset = dockedCount * (edge === 'left' || edge === 'right' ? dragged.height : dragged.width) +
    dockedCount * BENTO_GAP;

  switch (edge) {
    case 'left':
      return { x: target.x - BENTO_GAP - dragged.width, y: target.y + stackOffset };
    case 'right':
      return { x: target.x + target.width + BENTO_GAP, y: target.y + stackOffset };
    case 'top':
      return { x: target.x + stackOffset, y: target.y - BENTO_GAP - dragged.height };
    case 'bottom':
      return { x: target.x + stackOffset, y: target.y + target.height + BENTO_GAP };
  }
}

function tryImageDock(
  dragged: SnapCandidate,
  others: readonly SnapCandidate[],
  thresholdWorld: number
): SnapResult | null {
  if (!dragged.isColorBearing) return null;

  let nearest: { image: SnapCandidate; gap: number } | null = null;
  for (const other of others) {
    if (!other.isImage) continue;
    const gap = rectGap(dragged, other);
    if (gap <= thresholdWorld && (nearest === null || gap < nearest.gap)) {
      nearest = { image: other, gap };
    }
  }
  if (nearest === null) return null;

  const edge = nearestEdge(dragged, nearest.image);
  const dockedCount = countAlreadyDocked(nearest.image, edge, others, dragged.id);
  const position = dockPosition(dragged, nearest.image, edge, dockedCount);

  const guideAlong: AlignmentGuide =
    edge === 'left' || edge === 'right'
      ? {
          axis: 'x',
          position: edge === 'left' ? nearest.image.x : nearest.image.x + nearest.image.width,
          start: Math.min(nearest.image.y, position.y),
          end: Math.max(nearest.image.y + nearest.image.height, position.y + dragged.height),
        }
      : {
          axis: 'y',
          position: edge === 'top' ? nearest.image.y : nearest.image.y + nearest.image.height,
          start: Math.min(nearest.image.x, position.x),
          end: Math.max(nearest.image.x + nearest.image.width, position.x + dragged.width),
        };

  return {
    x: position.x,
    y: position.y,
    snapped: true,
    snapKind: 'image-dock',
    guides: [guideAlong],
    dockedToId: nearest.image.id,
  };
}

interface AxisMatch {
  readonly value: number;
  readonly delta: number;
  readonly guide: AlignmentGuide;
}

function collectAxisMatches(
  dragged: Rect,
  other: Rect,
  axis: 'x' | 'y',
  threshold: number
): AxisMatch[] {
  const draggedMin = axis === 'x' ? dragged.x : dragged.y;
  const draggedSize = axis === 'x' ? dragged.width : dragged.height;
  const otherMin = axis === 'x' ? other.x : other.y;
  const otherSize = axis === 'x' ? other.width : other.height;
  const otherMax = otherMin + otherSize;

  const crossStart = Math.min(
    axis === 'x' ? dragged.y : dragged.x,
    axis === 'x' ? other.y : other.x
  );
  const crossEnd = Math.max(
    axis === 'x' ? dragged.y + dragged.height : dragged.x + dragged.width,
    axis === 'x' ? other.y + other.height : other.x + other.width
  );

  const options: { value: number; guidePosition: number }[] = [
    { value: otherMax + BENTO_GAP, guidePosition: otherMax + BENTO_GAP / 2 },
    { value: otherMin - BENTO_GAP - draggedSize, guidePosition: otherMin - BENTO_GAP / 2 },
    { value: otherMin + otherSize / 2 - draggedSize / 2, guidePosition: otherMin + otherSize / 2 },
  ];

  const matches: AxisMatch[] = [];
  for (const option of options) {
    const delta = Math.abs(option.value - draggedMin);
    if (delta <= threshold) {
      matches.push({
        value: option.value,
        delta,
        guide: { axis, position: option.guidePosition, start: crossStart, end: crossEnd },
      });
    }
  }
  return matches;
}

function tryBentoSnap(
  dragged: SnapCandidate,
  others: readonly SnapCandidate[],
  thresholdWorld: number
): SnapResult | null {
  let bestX: AxisMatch | null = null;
  let bestY: AxisMatch | null = null;

  for (const other of others) {
    if (other.id === dragged.id) continue;
    for (const match of collectAxisMatches(dragged, other, 'x', thresholdWorld)) {
      if (bestX === null || match.delta < bestX.delta) bestX = match;
    }
    for (const match of collectAxisMatches(dragged, other, 'y', thresholdWorld)) {
      if (bestY === null || match.delta < bestY.delta) bestY = match;
    }
  }

  if (bestX === null && bestY === null) return null;

  const guides: AlignmentGuide[] = [];
  if (bestX !== null) guides.push(bestX.guide);
  if (bestY !== null) guides.push(bestY.guide);

  return {
    x: bestX?.value ?? dragged.x,
    y: bestY?.value ?? dragged.y,
    snapped: true,
    snapKind: 'bento',
    guides,
    dockedToId: null,
  };
}

const NO_SNAP: SnapResult = {
  x: 0,
  y: 0,
  snapped: false,
  snapKind: null,
  guides: [],
  dockedToId: null,
};

/**
 * Solves for where `dragged` should land given every other card currently
 * on the board, and the camera zoom (used to convert the authored
 * screen-space thresholds into world units for this comparison). Image
 * docking is checked first — it's the more specific, more visually
 * distinctive behaviour, so it should win when a color card is dragged
 * near both an image and some unrelated card's edge at once.
 */
export function findSnap(
  dragged: SnapCandidate,
  others: readonly SnapCandidate[],
  zoom: number
): SnapResult {
  const dockThreshold = IMAGE_DOCK_THRESHOLD_SCREEN_PX / zoom;
  const bentoThreshold = BENTO_SNAP_THRESHOLD_SCREEN_PX / zoom;

  const docked = tryImageDock(dragged, others, dockThreshold);
  if (docked !== null) return docked;

  const bento = tryBentoSnap(dragged, others, bentoThreshold);
  if (bento !== null) return bento;

  return { ...NO_SNAP, x: dragged.x, y: dragged.y };
}
