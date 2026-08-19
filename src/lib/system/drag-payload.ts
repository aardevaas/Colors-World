import type { DragEvent } from 'react';
import type { Oklch } from '@/lib/color-engine';

/**
 * Shared drag-and-drop contract between a Library card (drag source) and
 * the System Bar (drop target) — one custom MIME type both sides agree
 * on, rather than each re-deriving hex/oklch from whatever HTML the drag
 * happened to carry.
 */
export const SWATCH_DRAG_MIME_TYPE = 'application/x-colorsworld-swatch';

export interface SwatchDragPayload {
  readonly hex: string;
  readonly oklch: Oklch;
}

export function setSwatchDragPayload(
  event: DragEvent<HTMLElement>,
  payload: SwatchDragPayload
): void {
  event.dataTransfer.setData(SWATCH_DRAG_MIME_TYPE, JSON.stringify(payload));
  event.dataTransfer.effectAllowed = 'copy';
}

/** Returns `null` for anything that isn't a well-formed payload — a drag
 *  from outside the app (an image, a link, plain text) should be ignored,
 *  not crash the drop handler. */
export function readSwatchDragPayload(event: DragEvent<HTMLElement>): SwatchDragPayload | null {
  try {
    const raw = event.dataTransfer.getData(SWATCH_DRAG_MIME_TYPE);
    if (raw === '') return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as SwatchDragPayload).hex !== 'string' ||
      typeof (parsed as SwatchDragPayload).oklch !== 'object'
    ) {
      return null;
    }
    return parsed as SwatchDragPayload;
  } catch {
    return null;
  }
}
