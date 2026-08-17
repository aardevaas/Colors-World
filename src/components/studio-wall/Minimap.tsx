'use client';

import type { MouseEvent as ReactMouseEvent } from 'react';
import { WORLD_BOUNDS, type CameraState, type Rect, type Viewport } from '@/lib/studio/camera';
import styles from './studio-wall.module.css';

const MINIMAP_WIDTH = 160;
const MINIMAP_HEIGHT = 120;

interface MinimapProps {
  readonly cardRects: readonly Rect[];
  readonly camera: CameraState;
  readonly viewportSize: Viewport;
  readonly onNavigate: (worldX: number, worldY: number) => void;
}

/**
 * A small always-visible overview of the whole 20,000 x 20,000 world —
 * every card as a tick, the camera's current visible area as an outline,
 * click-to-navigate. The one way to know where you are, and where else
 * there is to go, once the board is bigger than one screen can show.
 */
export function Minimap({ cardRects, camera, viewportSize, onNavigate }: MinimapProps) {
  const worldWidth = WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX;
  const worldHeight = WORLD_BOUNDS.maxY - WORLD_BOUNDS.minY;
  const scaleX = MINIMAP_WIDTH / worldWidth;
  const scaleY = MINIMAP_HEIGHT / worldHeight;

  const visibleWidth = viewportSize.width / camera.zoom;
  const visibleHeight = viewportSize.height / camera.zoom;

  function handleClick(event: ReactMouseEvent<HTMLDivElement>): void {
    const rect = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    onNavigate(
      WORLD_BOUNDS.minX + localX / scaleX,
      WORLD_BOUNDS.minY + localY / scaleY
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
            left: (rect.x - WORLD_BOUNDS.minX) * scaleX,
            top: (rect.y - WORLD_BOUNDS.minY) * scaleY,
            width: Math.max(2, rect.width * scaleX),
            height: Math.max(2, rect.height * scaleY),
          }}
        />
      ))}
      <div
        className={styles.minimapViewport}
        style={{
          left: (camera.x - visibleWidth / 2 - WORLD_BOUNDS.minX) * scaleX,
          top: (camera.y - visibleHeight / 2 - WORLD_BOUNDS.minY) * scaleY,
          width: visibleWidth * scaleX,
          height: visibleHeight * scaleY,
        }}
      />
    </div>
  );
}
