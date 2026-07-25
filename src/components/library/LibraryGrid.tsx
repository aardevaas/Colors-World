'use client';

import { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion } from 'framer-motion';
import { indexToSwatch, type GeneratedSwatch } from '@/lib/spectrum/generate-color';
import { shuffledIndex } from '@/lib/spectrum/discovery-feed';
import type { ColorRecord } from '@/lib/supabase/colors';
import type { LibraryFeedMode } from '@/lib/spectrum/library-feed-reducer';
import { LibraryCard } from './LibraryCard';
import styles from './library.module.css';

/**
 * Bigger than the old Spectrum browser's 56px flat swatch tiles — this card
 * carries a hex label, a 10-step family stepper, and a hover action row, so
 * it needs real room rather than being a pure colour chip.
 *
 * CELL_MIN_WIDTH only decides how many columns fit (`floor(containerWidth /
 * CELL_MIN_WIDTH)`) — the actual rendered column width is
 * `containerWidth / columns`, which almost never equals CELL_MIN_WIDTH
 * exactly (the remainder is spread across the `1fr` columns). CARD_HEIGHT is
 * therefore a genuinely fixed pixel height (see library.module.css's `.card`
 * — deliberately not `aspect-ratio`), so the row virtualizer's height
 * estimate can stay a true constant no matter how that division comes out.
 * Getting this out of sync is exactly what produces overlapping rows.
 */
const CELL_MIN_WIDTH = 200;
const CARD_HEIGHT = 220;
const ROW_GAP = 14;
/** Once the last rendered row is within this many rows of the end of what's
 *  loaded, ask for the next batch — comfortably before the user could
 *  actually scroll past the end of what's been generated so far. */
const LOAD_MORE_THRESHOLD_ROWS = 4;
export const LIBRARY_BATCH_SIZE = 60;

interface LibraryGridProps {
  readonly mode: LibraryFeedMode;
  readonly seed: number;
  readonly loadedCount: number;
  readonly vibeSwatches: readonly GeneratedSwatch[];
  readonly semanticMatches: ReadonlyMap<number, ColorRecord>;
  readonly onNeedMore: (amount: number) => void;
  readonly onVisibleIndicesChange: (indices: readonly number[]) => void;
  readonly onOpenDrawer: (swatch: GeneratedSwatch, semanticMatch: ColorRecord | null) => void;
  /** Changes exactly once per reshuffle (the shell reuses its new seed for
   *  this) — remounts the rendered cells so the entrance stagger replays,
   *  and snaps scroll back to the top of the fresh sequence. */
  readonly resetKey: number;
}

export function LibraryGrid({
  mode,
  seed,
  loadedCount,
  vibeSwatches,
  semanticMatches,
  onNeedMore,
  onVisibleIndicesChange,
  onOpenDrawer,
  resetKey,
}: LibraryGridProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const el = parentRef.current;
    if (el === null) return;

    function measure(width: number) {
      setColumns(Math.max(1, Math.floor(width / CELL_MIN_WIDTH)));
    }

    measure(el.clientWidth);
    const observer = new ResizeObserver((entries) => {
      measure(entries[0]?.contentRect.width ?? el.clientWidth);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (parentRef.current !== null) parentRef.current.scrollTop = 0;
  }, [resetKey]);

  const itemCount = mode === 'shuffle' ? loadedCount : vibeSwatches.length;
  const rowCount = Math.max(1, Math.ceil(itemCount / columns));

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CARD_HEIGHT + ROW_GAP,
    overscan: 3,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  function resolveSwatch(position: number): GeneratedSwatch {
    if (mode === 'vibe') return vibeSwatches[position]!;
    return indexToSwatch(shuffledIndex(position, seed));
  }

  const visibleRowIndices = virtualRows.map((row) => row.index).join(',');

  useEffect(() => {
    if (virtualRows.length === 0) return;
    const lastRow = virtualRows[virtualRows.length - 1]!;
    const startPos = virtualRows[0]!.index * columns;
    const endPosExclusive = Math.min(itemCount, (lastRow.index + 1) * columns);

    const indices: number[] = [];
    for (let pos = startPos; pos < endPosExclusive; pos += 1) {
      indices.push(resolveSwatch(pos).index);
    }
    if (indices.length > 0) onVisibleIndicesChange(indices);

    if (mode === 'shuffle' && rowCount - 1 - lastRow.index <= LOAD_MORE_THRESHOLD_ROWS) {
      onNeedMore(LIBRARY_BATCH_SIZE);
    }
    // resolveSwatch/onNeedMore/onVisibleIndicesChange intentionally excluded:
    // this should only re-run when the actual visible window, item count, or
    // feed identity (mode/seed) changes — not on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRowIndices, columns, mode, seed, itemCount, rowCount]);

  if (itemCount === 0) {
    return (
      <div className={styles.gridEmpty}>
        No matches in range yet — try a broader vibe, or shuffle for a fresh set.
      </div>
    );
  }

  return (
    <div ref={parentRef} className={styles.gridScroll}>
      <div key={resetKey} style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
        {virtualRows.map((virtualRow) => {
          const startPos = virtualRow.index * columns;
          const positions = Array.from({ length: columns }, (_, col) => startPos + col).filter(
            (pos) => pos < itemCount
          );

          return (
            <div
              key={virtualRow.key}
              className={styles.gridRow}
              style={{
                transform: `translateY(${virtualRow.start}px)`,
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
              }}
            >
              {positions.map((pos) => {
                const swatch = resolveSwatch(pos);
                const columnIndex = pos - startPos;
                return (
                  <motion.div
                    key={`${resetKey}-${pos}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.35,
                      delay: Math.min(0.4, (virtualRow.index % 6) * 0.03 + columnIndex * 0.02),
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    <LibraryCard
                      swatch={swatch}
                      semanticMatch={semanticMatches.get(swatch.index) ?? null}
                      onOpenDrawer={onOpenDrawer}
                    />
                  </motion.div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
