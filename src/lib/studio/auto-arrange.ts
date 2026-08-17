/**
 * Pure editorial moodboard layout — the Auto-Format Board action's engine.
 * No DOM, no React. Cards keep their own width/height (nothing is resized
 * to fit a grid cell); a shortest-column masonry pack is what makes an
 * uneven mix of note/color/image/palette cards read as a magazine spread
 * instead of a uniform grid, while still guaranteeing zero overlaps.
 *
 * Rotation is always reset to 0 in the output — landing flat is the visual
 * confirmation that a card is part of the tidy layout, matching the same
 * "rotation snaps to 0 on snap" rule the drag/dock interactions use.
 */

import { WORLD_BOUNDS, type WorldBounds } from './camera';

export interface ArrangeInput {
  readonly id: string;
  readonly width: number;
  readonly height: number;
}

export interface ArrangedPosition {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly rotation: 0;
}

export interface AutoArrangeOptions {
  /** Overrides the deterministic column count derived from item count. */
  readonly columns?: number;
  readonly gap?: number;
  readonly originX?: number;
  readonly originY?: number;
  readonly bounds?: WorldBounds;
}

const DEFAULT_GAP = 24;
const MAX_AUTO_COLUMNS = 6;

/** Squarish default: 1 item -> 1 column, 4 -> 2, 9 -> 3, capped so a huge
 *  board doesn't sprawl into one absurdly wide row. */
function pickColumnCount(itemCount: number): number {
  return Math.max(1, Math.min(MAX_AUTO_COLUMNS, Math.round(Math.sqrt(itemCount))));
}

function boundingBoxWidth(columns: number, columnWidth: number, gap: number): number {
  return columns * columnWidth + Math.max(0, columns - 1) * gap;
}

/** Narrows the column count (taller, narrower layout) until the pack's
 *  total width fits the available world space — a real constraint only for
 *  pathologically wide cards or budgets, but it keeps the guarantee exact
 *  rather than "true for realistic inputs." */
function fitColumnsToWidth(preferred: number, columnWidth: number, gap: number, maxWidth: number): number {
  let columns = preferred;
  while (columns > 1 && boundingBoxWidth(columns, columnWidth, gap) > maxWidth) {
    columns -= 1;
  }
  return columns;
}

/**
 * Lays out `items` as a shortest-column masonry pack, in input order.
 * Deterministic and idempotent: the same items array (regardless of any
 * x/y it carried before — this function never reads position, only id/
 * width/height) always produces the same output, so re-running it on an
 * already-arranged board doesn't drift or jitter anything.
 */
export function autoArrange(
  items: readonly ArrangeInput[],
  options: AutoArrangeOptions = {}
): ArrangedPosition[] {
  if (items.length === 0) return [];

  const gap = options.gap ?? DEFAULT_GAP;
  const originX = options.originX ?? 0;
  const originY = options.originY ?? 0;
  const bounds = options.bounds ?? WORLD_BOUNDS;

  const columnWidth = Math.max(...items.map((item) => item.width));
  const availableWidth = bounds.maxX - originX;
  const columns = fitColumnsToWidth(
    options.columns ?? pickColumnCount(items.length),
    columnWidth,
    gap,
    availableWidth
  );

  const columnHeights = new Array(columns).fill(0) as number[];
  const positions: ArrangedPosition[] = [];

  for (const item of items) {
    let targetColumn = 0;
    for (let column = 1; column < columns; column += 1) {
      if (columnHeights[column]! < columnHeights[targetColumn]!) targetColumn = column;
    }

    const x = originX + targetColumn * (columnWidth + gap);
    const y = originY + columnHeights[targetColumn]!;
    positions.push({ id: item.id, x, y, rotation: 0 });
    columnHeights[targetColumn] = columnHeights[targetColumn]! + item.height + gap;
  }

  return positions;
}
