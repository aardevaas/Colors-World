'use client';

import { useMemo } from 'react';
import { MAX_DROPS, buildDrops, fieldOpacity } from '@/lib/landing/rain';
import type { RoomColor } from '@/lib/landing/room-palette';
import styles from './paint-rain.module.css';

/**
 * Cartoonish paint droplets falling across the page.
 *
 * Very sparse at rest — at the top of the page this should read as the odd
 * drop drifting past, not as weather. The count is the single dial: it
 * selects how many of a fixed field are shown rather than mounting and
 * unmounting elements, so ramping it while scrolling never restarts anyone's
 * fall.
 *
 * Each drop carries one of the six room hues. That is deliberate groundwork:
 * the rain is meant to be what fills and feeds the six rooms further down, so
 * the colors have to agree from the first drop.
 *
 * Fixed to the viewport rather than the document. Rain that scrolls with the
 * page is not rain — it is a texture sliding past.
 */

interface PaintRainProps {
  /** How many drops to show. The caller quantises intensity to this integer so
   *  the field only re-renders when the count genuinely changes, rather than on
   *  every frame of the scroll. */
  readonly count: number;
  readonly rooms: readonly RoomColor[];
  readonly reducedMotion?: boolean;
}

export function PaintRain({ count, rooms, reducedMotion = false }: PaintRainProps) {
  const drops = useMemo(() => buildDrops(), []);

  if (reducedMotion || count <= 0) return null;

  return (
    <div
      className={styles.field}
      aria-hidden="true"
      style={{ opacity: fieldOpacity(count / MAX_DROPS) }}
    >
      {drops.slice(0, count).map((drop, index) => {
        const room = rooms[drop.roomIndex % Math.max(1, rooms.length)];
        return (
          <span
            key={`${drop.left}-${drop.size}-${index}`}
            className={styles.drop}
            style={
              {
                '--left': `${drop.left}%`,
                '--size': `${drop.size}px`,
                '--duration': `${drop.duration}s`,
                '--delay': `${drop.delay}s`,
                '--sway': `${drop.sway}px`,
                '--hue': room?.hex ?? '#7c5cff',
                // Depth drives blur and scale together, so a distant drop is
                // softer *and* smaller rather than just faded.
                '--blur': `${drop.depth * 2.4}px`,
                '--dim': `${1 - drop.depth * 0.45}`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

export default PaintRain;
