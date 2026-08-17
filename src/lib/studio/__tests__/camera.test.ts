import { describe, expect, it } from 'vitest';
import {
  applyRubberBand,
  cameraToFrame,
  clampCameraToBounds,
  interpolateCamera,
  screenToWorld,
  worldToScreen,
  zoomAtPoint,
  MAX_ZOOM,
  MIN_ZOOM,
  WORLD_BOUNDS,
  type CameraState,
  type Viewport,
} from '../camera';

const VIEWPORT: Viewport = { width: 1200, height: 800 };
const CAMERA: CameraState = { x: 5000, y: 5000, zoom: 1 };

describe('screenToWorld / worldToScreen', () => {
  it('round-trips exactly at zoom 1', () => {
    const screenPoint = { x: 300, y: 450 };
    const world = screenToWorld(screenPoint, CAMERA, VIEWPORT);
    const back = worldToScreen(world, CAMERA, VIEWPORT);
    expect(back.x).toBeCloseTo(screenPoint.x, 6);
    expect(back.y).toBeCloseTo(screenPoint.y, 6);
  });

  it('round-trips at several zoom levels', () => {
    for (const zoom of [0.15, 0.5, 1, 2, 3.7]) {
      const camera = { ...CAMERA, zoom };
      const screenPoint = { x: 812, y: 113 };
      const world = screenToWorld(screenPoint, camera, VIEWPORT);
      const back = worldToScreen(world, camera, VIEWPORT);
      expect(back.x).toBeCloseTo(screenPoint.x, 6);
      expect(back.y).toBeCloseTo(screenPoint.y, 6);
    }
  });

  it('the viewport center always maps to the camera position', () => {
    const center = { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 };
    const world = screenToWorld(center, CAMERA, VIEWPORT);
    expect(world.x).toBeCloseTo(CAMERA.x, 6);
    expect(world.y).toBeCloseTo(CAMERA.y, 6);
  });
});

describe('zoomAtPoint — the zoom-to-cursor invariant', () => {
  it('keeps the world point under the cursor fixed under the cursor after zooming in', () => {
    const cursorScreen = { x: 940, y: 210 };
    const worldUnderCursorBefore = screenToWorld(cursorScreen, CAMERA, VIEWPORT);

    const zoomed = zoomAtPoint(CAMERA, cursorScreen, VIEWPORT, 2.5);
    const screenAfter = worldToScreen(worldUnderCursorBefore, zoomed, VIEWPORT);

    expect(screenAfter.x).toBeCloseTo(cursorScreen.x, 6);
    expect(screenAfter.y).toBeCloseTo(cursorScreen.y, 6);
  });

  it('keeps the world point under the cursor fixed after zooming out', () => {
    const cursorScreen = { x: 50, y: 720 };
    const camera: CameraState = { x: 8000, y: 3000, zoom: 2 };
    const worldUnderCursorBefore = screenToWorld(cursorScreen, camera, VIEWPORT);

    const zoomed = zoomAtPoint(camera, cursorScreen, VIEWPORT, 0.6);
    const screenAfter = worldToScreen(worldUnderCursorBefore, zoomed, VIEWPORT);

    expect(screenAfter.x).toBeCloseTo(cursorScreen.x, 6);
    expect(screenAfter.y).toBeCloseTo(cursorScreen.y, 6);
  });

  it('holds at an off-center cursor position, not just the viewport center', () => {
    const cursorScreen = { x: 1150, y: 40 };
    const worldUnderCursorBefore = screenToWorld(cursorScreen, CAMERA, VIEWPORT);
    const zoomed = zoomAtPoint(CAMERA, cursorScreen, VIEWPORT, 3);
    const screenAfter = worldToScreen(worldUnderCursorBefore, zoomed, VIEWPORT);
    expect(screenAfter.x).toBeCloseTo(cursorScreen.x, 6);
    expect(screenAfter.y).toBeCloseTo(cursorScreen.y, 6);
  });

  it('clamps the requested zoom to [MIN_ZOOM, MAX_ZOOM]', () => {
    expect(zoomAtPoint(CAMERA, { x: 0, y: 0 }, VIEWPORT, 999).zoom).toBe(MAX_ZOOM);
    expect(zoomAtPoint(CAMERA, { x: 0, y: 0 }, VIEWPORT, 0.0001).zoom).toBe(MIN_ZOOM);
  });
});

describe('clampCameraToBounds', () => {
  it('leaves an in-bounds camera untouched', () => {
    expect(clampCameraToBounds(CAMERA)).toEqual(CAMERA);
  });

  it('pulls an out-of-bounds camera back inside the world', () => {
    const outside: CameraState = { x: -500, y: 25_000, zoom: 1 };
    const clamped = clampCameraToBounds(outside);
    expect(clamped.x).toBe(WORLD_BOUNDS.minX);
    expect(clamped.y).toBe(WORLD_BOUNDS.maxY);
  });
});

describe('applyRubberBand', () => {
  it('leaves an in-bounds camera untouched', () => {
    expect(applyRubberBand(CAMERA)).toEqual(CAMERA);
  });

  it('damps out-of-bounds excess rather than allowing it 1:1 or blocking it', () => {
    const outside: CameraState = { x: -1000, y: 5000, zoom: 1 };
    const damped = applyRubberBand(outside);
    // Still moved past the boundary (not a hard wall)...
    expect(damped.x).toBeLessThan(WORLD_BOUNDS.minX);
    // ...but nowhere near the full 1000px excess (damped, not passthrough).
    expect(damped.x).toBeGreaterThan(-1000);
  });

  it('damping grows sub-linearly — doubling the excess less than doubles the damped offset', () => {
    const small = applyRubberBand({ x: -200, y: 5000, zoom: 1 });
    const large = applyRubberBand({ x: -400, y: 5000, zoom: 1 });
    const smallOffset = WORLD_BOUNDS.minX - small.x;
    const largeOffset = WORLD_BOUNDS.minX - large.x;
    expect(largeOffset).toBeLessThan(smallOffset * 2);
  });
});

describe('interpolateCamera', () => {
  const from: CameraState = { x: 0, y: 0, zoom: 1 };
  const to: CameraState = { x: 1000, y: 2000, zoom: 4 };

  it('starts exactly at "from" and ends exactly at "to"', () => {
    expect(interpolateCamera(from, to, 0)).toEqual(from);
    const end = interpolateCamera(from, to, 1);
    expect(end.x).toBeCloseTo(to.x, 6);
    expect(end.y).toBeCloseTo(to.y, 6);
    expect(end.zoom).toBeCloseTo(to.zoom, 6);
  });

  it('interpolates zoom geometrically (log-space), not linearly', () => {
    const t = 0.5;
    const mid = interpolateCamera(from, to, t);

    // The function applies cubic ease-out to t before interpolating, so the
    // expected value has to go through that same eased fraction rather
    // than assuming raw t=0.5 lands at the halfway point of either curve.
    const eased = 1 - Math.pow(1 - t, 3);
    const expectedGeometricZoom = Math.exp(
      Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * eased
    );
    const linearZoom = from.zoom + (to.zoom - from.zoom) * eased;

    expect(mid.zoom).toBeCloseTo(expectedGeometricZoom, 5);
    // A real regression guard: if this ever gets "simplified" to linear
    // interpolation, this assertion catches it.
    expect(mid.zoom).not.toBeCloseTo(linearZoom, 1);
  });

  it('clamps t outside [0,1]', () => {
    expect(interpolateCamera(from, to, -5)).toEqual(interpolateCamera(from, to, 0));
    expect(interpolateCamera(from, to, 5).x).toBeCloseTo(to.x, 6);
  });
});

describe('cameraToFrame', () => {
  it('centers the camera on the bounding box of the given rects', () => {
    const camera = cameraToFrame(
      [
        { x: 100, y: 100, width: 200, height: 200 },
        { x: 500, y: 300, width: 100, height: 100 },
      ],
      VIEWPORT
    );
    // Bounding box: (100,100) to (600,400) -> center (350, 250)
    expect(camera.x).toBeCloseTo(350, 6);
    expect(camera.y).toBeCloseTo(250, 6);
  });

  it('picks a zoom that fits the padded content in the viewport', () => {
    const camera = cameraToFrame([{ x: 0, y: 0, width: 1000, height: 1000 }], VIEWPORT);
    // Every framed rect should be fully visible on screen at the resulting camera.
    const topLeft = worldToScreen({ x: 0, y: 0 }, camera, VIEWPORT);
    const bottomRight = worldToScreen({ x: 1000, y: 1000 }, camera, VIEWPORT);
    expect(topLeft.x).toBeGreaterThanOrEqual(-1);
    expect(topLeft.y).toBeGreaterThanOrEqual(-1);
    expect(bottomRight.x).toBeLessThanOrEqual(VIEWPORT.width + 1);
    expect(bottomRight.y).toBeLessThanOrEqual(VIEWPORT.height + 1);
  });

  it('falls back to framing the whole world when there is nothing to frame', () => {
    const camera = cameraToFrame([], VIEWPORT);
    expect(camera.x).toBeCloseTo((WORLD_BOUNDS.minX + WORLD_BOUNDS.maxX) / 2, 6);
    expect(camera.y).toBeCloseTo((WORLD_BOUNDS.minY + WORLD_BOUNDS.maxY) / 2, 6);
  });

  it('never returns a zoom outside [MIN_ZOOM, MAX_ZOOM]', () => {
    const tiny = cameraToFrame([{ x: 0, y: 0, width: 1, height: 1 }], VIEWPORT);
    expect(tiny.zoom).toBeLessThanOrEqual(MAX_ZOOM);
    const huge = cameraToFrame([{ x: 0, y: 0, width: 100_000, height: 100_000 }], VIEWPORT);
    expect(huge.zoom).toBeGreaterThanOrEqual(MIN_ZOOM);
  });
});
