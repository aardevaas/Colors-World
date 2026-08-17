'use client';

import type { MouseEvent as ReactMouseEvent } from 'react';
import type { CameraState, Rect, Viewport } from '@/lib/studio/camera';
import styles from './studio-wall.module.css';

const MINIMAP_WIDTH = 160;
const MINIMAP_HEIGHT = 120;

/** How much empty space to leave around the content, as a fraction of the
 *  framed region — enough that cards near an edge don't sit flush against
 *  the minimap border. */
const MINIMAP_PADDING_RATIO = 0.12;

/** What the minimap shows when the board is empty: an arbitrary but stable
 *  window around the camera, so the viewport rect has something to sit in
 *  rather than collapsing to a dot. */
const EMPTY_BOARD_SPAN = 3000;

interface MinimapProps {
  readonly cardRects: readonly Rect[];
  readonly camera: CameraState;
  readonly viewportSize: Viewport;
  readonly onNavigate: (worldX: number, worldY: number) => void;
}

interface Region {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Frames the union of the cards and the current viewport, padded, and
 * preserving the minimap's aspect ratio.
 *
 * Deliberately *not* the full 20,000 x 20,000 world: at world scale a real
 * board occupies well under 1% of the area, so every card collapsed into a
 * ~2px clump in the corner and the viewport rectangle was invisible — the
 * minimap was decorative rather than informative. Including the viewport in
 * the union is what keeps "where am I relative to my work" answerable when
 * the camera has been panned away from the cards.
 */
function framedRegion(cardRects: readonly Rect[], camera: CameraState, viewportSize: Viewport): Region {
  const visibleWidth = viewportSize.width / camera.zoom;
  const visibleHeight = viewportSize.height / camera.zoom;

  let minX: number;
  let minY: number;
  let maxX: number;
  let maxY: number;

  if (cardRects.length === 0) {
    minX = camera.x - EMPTY_BOARD_SPAN / 2;
    maxX = camera.x + EMPTY_BOARD_SPAN / 2;
    minY = camera.y - (EMPTY_BOARD_SPAN * MINIMAP_HEIGHT) / (2 * MINIMAP_WIDTH);
    maxY = camera.y + (EMPTY_BOARD_SPAN * MINIMAP_HEIGHT) / (2 * MINIMAP_WIDTH);
  } else {
    minX = Infinity;
    minY = Infinity;
    maxX = -Infinity;
    maxY = -Infinity;
    for (const rect of cardRects) {
      minX = Math.min(minX, rect.x);
      minY = Math.min(minY, rect.y);
      maxX = Math.max(maxX, rect.x + rect.width);
      maxY = Math.max(maxY, rect.y + rect.height);
    }
  }

  // Union with what's currently on screen.
  minX = Math.min(minX, camera.x - visibleWidth / 2);
  maxX = Math.max(maxX, camera.x + visibleWidth / 2);
  minY = Math.min(minY, camera.y - visibleHeight / 2);
  maxY = Math.max(maxY, camera.y + visibleHeight / 2);

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const padded = 1 + MINIMAP_PADDING_RATIO * 2;
  let width = Math.max(1, maxX - minX) * padded;
  let height = Math.max(1, maxY - minY) * padded;

  // Match the minimap's aspect ratio so nothing is squashed.
  const aspect = MINIMAP_WIDTH / MINIMAP_HEIGHT;
  if (width / height > aspect) height = width / aspect;
  else width = height * aspect;

  return { x: centerX - width / 2, y: centerY - height / 2, width, height };
}

/**
 * A small overview of where the board's content is and where the camera is
 * looking, with click-to-navigate. The one way to answer "where am I, and
 * what else is out there" once the board outgrows a single screen.
 */
export function Minimap({ cardRects, camera, viewportSize, onNavigate }: MinimapProps) {
  const region = framedRegion(cardRects, camera, viewportSize);
  const scaleX = MINIMAP_WIDTH / region.width;
  const scaleY = MINIMAP_HEIGHT / region.height;

  const visibleWidth = viewportSize.width / camera.zoom;
  const visibleHeight = viewportSize.height / camera.zoom;

  function handleClick(event: ReactMouseEvent<HTMLDivElement>): void {
    const rect = event.currentTarget.getBoundingClientRect();
    onNavigate(
      region.x + (event.clientX - rect.left) / scaleX,
      region.y + (event.clientY - rect.top) / scaleY
    );
  }

  return (
    <div
      className={styles.minimap}
      style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
      onClick={handleClick}
      role="button"
      aria-label="Minimap — click to navigate the board"
    >
      {cardRects.map((rect, index) => (
        <span
          key={index}
          className={styles.minimapCard}
          style={{
            left: (rect.x - region.x) * scaleX,
            top: (rect.y - region.y) * scaleY,
            width: Math.max(3, rect.width * scaleX),
            height: Math.max(3, rect.height * scaleY),
          }}
        />
      ))}
      <div
        className={styles.minimapViewport}
        style={{
          left: (camera.x - visibleWidth / 2 - region.x) * scaleX,
          top: (camera.y - visibleHeight / 2 - region.y) * scaleY,
          width: visibleWidth * scaleX,
          height: visibleHeight * scaleY,
        }}
      />
    </div>
  );
}
