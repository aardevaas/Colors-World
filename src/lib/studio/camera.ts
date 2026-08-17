/**
 * Pure pan/zoom/world-transform math for the Studio canvas. No React, no
 * DOM — every interactive feature (drag, proximity readout, snapping, the
 * minimap, fly-to, double-tap focus zoom) routes through screenToWorld /
 * worldToScreen rather than each re-deriving its own coordinate math, so
 * there is exactly one place a transform bug can live.
 *
 * Camera state is the world point sitting at the viewport's CENTER, not its
 * top-left — centering zoom math on the viewport's own center is what makes
 * "zoom to cursor" a small correction rather than a full re-derivation.
 */

export interface CameraState {
  readonly x: number;
  readonly y: number;
  /** World units per screen pixel is 1/zoom; zoom 1 means one world unit
   *  renders as one screen pixel. */
  readonly zoom: number;
}

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export interface WorldBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The spec's 20,000 x 20,000px bounded canvas, origin at top-left — matches
 *  the positive x/y convention board_items already uses. */
export const WORLD_BOUNDS: WorldBounds = { minX: 0, minY: 0, maxX: 20_000, maxY: 20_000 };

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function screenToWorld(screenPoint: Point, camera: CameraState, viewport: Viewport): Point {
  return {
    x: camera.x + (screenPoint.x - viewport.width / 2) / camera.zoom,
    y: camera.y + (screenPoint.y - viewport.height / 2) / camera.zoom,
  };
}

export function worldToScreen(worldPoint: Point, camera: CameraState, viewport: Viewport): Point {
  return {
    x: viewport.width / 2 + (worldPoint.x - camera.x) * camera.zoom,
    y: viewport.height / 2 + (worldPoint.y - camera.y) * camera.zoom,
  };
}

/**
 * Zooms so that whatever world point currently sits under `screenPoint`
 * stays under `screenPoint` after the zoom — the one formula that decides
 * whether pan/zoom feels real. Derived by rearranging screenToWorld's own
 * formula to solve for the camera position that keeps worldToScreen(worldPoint)
 * === screenPoint at the new zoom.
 */
export function zoomAtPoint(
  camera: CameraState,
  screenPoint: Point,
  viewport: Viewport,
  nextZoomRaw: number
): CameraState {
  const nextZoom = clamp(nextZoomRaw, MIN_ZOOM, MAX_ZOOM);
  const worldPoint = screenToWorld(screenPoint, camera, viewport);
  return {
    zoom: nextZoom,
    x: worldPoint.x - (screenPoint.x - viewport.width / 2) / nextZoom,
    y: worldPoint.y - (screenPoint.y - viewport.height / 2) / nextZoom,
  };
}

export function clampZoom(zoom: number): number {
  return clamp(zoom, MIN_ZOOM, MAX_ZOOM);
}

/**
 * Hard-clamps the camera's center inside the world bounds — used to spring
 * back once a rubber-banded drag is released. Not used mid-drag: see
 * applyRubberBand for how out-of-bounds panning is damped while a pointer
 * is still down.
 */
export function clampCameraToBounds(
  camera: CameraState,
  bounds: WorldBounds = WORLD_BOUNDS
): CameraState {
  return {
    ...camera,
    x: clamp(camera.x, bounds.minX, bounds.maxX),
    y: clamp(camera.y, bounds.minY, bounds.maxY),
  };
}

/** iOS-scroll-style resistance curve: excess distance past a boundary is
 *  damped rather than allowed 1:1 (dead) or blocked outright (a hard wall
 *  reads as broken, not "bounded") — small overshoots still move visibly,
 *  larger ones increasingly resist. */
const RUBBER_BAND_COEFFICIENT = 0.55;

function rubberBandDamp(excess: number, dimension: number): number {
  if (excess <= 0) return 0;
  return (RUBBER_BAND_COEFFICIENT * dimension * excess) / (dimension + RUBBER_BAND_COEFFICIENT * excess);
}

/**
 * Softly resists a camera position past the world bounds — call this on
 * every frame *while dragging* to compute the displayed (damped) camera,
 * while the drag itself keeps tracking the raw, unclamped position. On
 * release, animate from the raw position to clampCameraToBounds(raw).
 */
export function applyRubberBand(
  camera: CameraState,
  bounds: WorldBounds = WORLD_BOUNDS
): CameraState {
  const dimX = bounds.maxX - bounds.minX;
  const dimY = bounds.maxY - bounds.minY;

  let x = camera.x;
  if (x < bounds.minX) x = bounds.minX - rubberBandDamp(bounds.minX - x, dimX);
  else if (x > bounds.maxX) x = bounds.maxX + rubberBandDamp(x - bounds.maxX, dimX);

  let y = camera.y;
  if (y < bounds.minY) y = bounds.minY - rubberBandDamp(bounds.minY - y, dimY);
  else if (y > bounds.maxY) y = bounds.maxY + rubberBandDamp(y - bounds.maxY, dimY);

  return { ...camera, x, y };
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Interpolates between two camera states for a fly-to animation. Zoom is
 * interpolated in log space, not linearly — going from zoom 0.5 to 2 should
 * *feel* like the same amount of zoom motion as 2 to 8, and only geometric
 * (log-space) interpolation gives a constant perceived rate.
 */
export function interpolateCamera(from: CameraState, to: CameraState, t: number): CameraState {
  const eased = easeOutCubic(clamp(t, 0, 1));
  const logZoom =
    Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * eased;
  return {
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased,
    zoom: Math.exp(logZoom),
  };
}

const FRAME_PADDING_RATIO = 0.1;

/**
 * The most a "fit these rects" operation should ever magnify. Distinct from
 * MAX_ZOOM, which is the ceiling for *deliberate* zooming: fitting two small
 * cards into a large viewport mathematically wants 400%, which renders a
 * 240px note card two feet wide and reads as broken rather than helpful.
 * Callers pass what makes sense for the gesture — 1 for fit-all (never
 * magnify past natural size), a little more for focusing a single card.
 */
export const FIT_MAX_ZOOM = 1;

/**
 * Solves for the camera that frames every given rect with comfortable
 * padding — the target state for Shift+0 / "fit all". Falls back to
 * framing the whole world when there's nothing to frame, rather than
 * leaving the camera wherever it happened to be.
 *
 * `maxZoom` caps magnification for this particular framing; it cannot exceed
 * the global MAX_ZOOM ceiling regardless of what is passed.
 */
export function cameraToFrame(
  rects: readonly Rect[],
  viewport: Viewport,
  bounds: WorldBounds = WORLD_BOUNDS,
  maxZoom: number = MAX_ZOOM
): CameraState {
  const ceiling = Math.min(maxZoom, MAX_ZOOM);
  if (rects.length === 0) {
    const worldWidth = bounds.maxX - bounds.minX;
    const worldHeight = bounds.maxY - bounds.minY;
    return {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
      zoom: Math.min(
        ceiling,
        clampZoom(Math.min(viewport.width / worldWidth, viewport.height / worldHeight))
      ),
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const rect of rects) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }

  const paddedWidth = (maxX - minX) * (1 + FRAME_PADDING_RATIO * 2);
  const paddedHeight = (maxY - minY) * (1 + FRAME_PADDING_RATIO * 2);

  const zoom = Math.min(
    ceiling,
    clampZoom(
      Math.min(viewport.width / Math.max(1, paddedWidth), viewport.height / Math.max(1, paddedHeight))
    )
  );

  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, zoom };
}
