'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  applyRubberBand,
  cameraToFrame,
  clampCameraToBounds,
  interpolateCamera,
  zoomAtPoint,
  type CameraState,
  type Rect,
  type Viewport,
} from '@/lib/studio/camera';

/** Where a brand-new, empty board looks — roughly centred on the area
 *  nextBoardPosition (board.ts) actually drops the first few cards into,
 *  so a first-time visitor doesn't have to go hunting for their own cards. */
const DEFAULT_CAMERA: CameraState = { x: 600, y: 480, zoom: 1 };

const WHEEL_ZOOM_SENSITIVITY = 0.0015;
const SPRING_BACK_DURATION_MS = 320;

export interface UseCanvasCameraResult {
  readonly camera: CameraState;
  readonly viewportSize: Viewport;
  readonly viewportRef: (node: HTMLDivElement | null) => void;
  readonly worldTransform: string;
  readonly isPanning: boolean;
  readonly handleBackgroundPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  readonly handleBackgroundPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  readonly handleBackgroundPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  /** Animated fly-to that frames every given rect with padding — used for
   *  "fit all" (Shift+0, the zoom readout's reset button) and focus zoom on
   *  a single card (frame a one-rect array to zoom in tight on it). */
  readonly frameRects: (rects: readonly Rect[]) => void;
  /** Animated fly-to a specific world point at the camera's current zoom —
   *  what a minimap click navigates with, as opposed to frameRects's
   *  content-fitting zoom change. */
  readonly flyTo: (worldX: number, worldY: number) => void;
}

/**
 * Owns the Studio canvas's camera: viewport measurement, wheel-to-cursor
 * zoom, click-drag panning with rubber-band resistance past the world
 * bounds and a spring-back on release. Everything here routes through
 * lib/studio/camera.ts's pure math — this hook is just the DOM/React glue
 * around it (event listeners, refs, animation frames), kept separate from
 * card rendering so the two can evolve independently.
 */
export function useCanvasCamera(initialRects: readonly Rect[]): UseCanvasCameraResult {
  const [camera, setCamera] = useState<CameraState>(DEFAULT_CAMERA);
  const [viewportSize, setViewportSize] = useState<Viewport>({ width: 0, height: 0 });
  const [viewportEl, setViewportEl] = useState<HTMLDivElement | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const viewportSizeRef = useRef(viewportSize);
  viewportSizeRef.current = viewportSize;

  const initialRectsRef = useRef(initialRects);
  const hasAutoFramedRef = useRef(false);
  const panDragRef = useRef<{
    pointerId: number;
    startScreenX: number;
    startScreenY: number;
    startCamera: CameraState;
  } | null>(null);
  const rawCameraRef = useRef<CameraState>(camera);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (viewportEl === null) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry === undefined) return;
      setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(viewportEl);
    return () => observer.disconnect();
  }, [viewportEl]);

  // One-time initial framing once the viewport has a real size — only the
  // wall's first paint needs this; cards added afterward should never yank
  // the camera away from wherever the visitor has since panned to.
  useEffect(() => {
    if (hasAutoFramedRef.current) return;
    if (viewportSize.width === 0 || viewportSize.height === 0) return;
    hasAutoFramedRef.current = true;
    if (initialRectsRef.current.length > 0) {
      setCamera(cameraToFrame(initialRectsRef.current, viewportSize));
    }
  }, [viewportSize]);

  useEffect(() => {
    if (viewportEl === null) return;
    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      const rect = viewportEl!.getBoundingClientRect();
      const cursor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const prev = cameraRef.current;
      const nextZoom = prev.zoom * Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY);
      setCamera(zoomAtPoint(prev, cursor, viewportSizeRef.current, nextZoom));
    }
    viewportEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewportEl.removeEventListener('wheel', handleWheel);
  }, [viewportEl]);

  useEffect(
    () => () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    },
    []
  );

  function springCameraTo(target: CameraState): void {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    const start = cameraRef.current;
    const startTime = performance.now();
    function tick(now: number) {
      const t = Math.min(1, (now - startTime) / SPRING_BACK_DURATION_MS);
      setCamera(interpolateCamera(start, target, t));
      animationFrameRef.current = t < 1 ? requestAnimationFrame(tick) : null;
    }
    animationFrameRef.current = requestAnimationFrame(tick);
  }

  function handleBackgroundPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    panDragRef.current = {
      pointerId: event.pointerId,
      startScreenX: event.clientX,
      startScreenY: event.clientY,
      startCamera: cameraRef.current,
    };
    rawCameraRef.current = cameraRef.current;
    setIsPanning(true);
  }

  function handleBackgroundPointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = panDragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    const dxScreen = event.clientX - drag.startScreenX;
    const dyScreen = event.clientY - drag.startScreenY;
    const raw: CameraState = {
      x: drag.startCamera.x - dxScreen / drag.startCamera.zoom,
      y: drag.startCamera.y - dyScreen / drag.startCamera.zoom,
      zoom: drag.startCamera.zoom,
    };
    rawCameraRef.current = raw;
    setCamera(applyRubberBand(raw));
  }

  function handleBackgroundPointerUp(event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = panDragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    panDragRef.current = null;
    setIsPanning(false);
    const raw = rawCameraRef.current;
    const clamped = clampCameraToBounds(raw);
    if (clamped.x !== raw.x || clamped.y !== raw.y) springCameraTo(clamped);
  }

  function frameRects(rects: readonly Rect[]): void {
    if (viewportSizeRef.current.width === 0 || viewportSizeRef.current.height === 0) return;
    springCameraTo(cameraToFrame(rects, viewportSizeRef.current));
  }

  function flyTo(worldX: number, worldY: number): void {
    springCameraTo({ x: worldX, y: worldY, zoom: cameraRef.current.zoom });
  }

  const worldTransform = `translate(${viewportSize.width / 2 - camera.x * camera.zoom}px, ${
    viewportSize.height / 2 - camera.y * camera.zoom
  }px) scale(${camera.zoom})`;

  return {
    camera,
    viewportSize,
    viewportRef: setViewportEl,
    worldTransform,
    isPanning,
    handleBackgroundPointerDown,
    handleBackgroundPointerMove,
    handleBackgroundPointerUp,
    frameRects,
    flyTo,
  };
}
