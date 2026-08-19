'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { parseColor } from '@/lib/color-engine';
import { extractPaletteFromImageFile } from '@/lib/image/sample-image-file';
import { useSystem } from '@/lib/system/system-context';
import styles from './image-seed.module.css';

/**
 * Start a System from a photograph.
 *
 * The extraction itself has existed for a while and has been reachable from
 * exactly one place: dropping an image onto the Studio canvas, which is the
 * last room in the workflow and the one nobody opens first. Here it sits where
 * a person actually starts, and it produces a System rather than a card —
 * meaning the colours pulled out of a photograph immediately become the
 * palette, the roles and the type colours everywhere else.
 *
 * The whole page is the drop target, not a small dashed rectangle. Aiming a
 * dragged file at a specific box is a needless test of motor control when the
 * page has nothing else a file could mean.
 */

const MAX_COLORS = 6;
/** Sampling is synchronous canvas work; a very large file blocks paint. */
const MAX_BYTES = 25 * 1024 * 1024;

type Status =
  | { readonly kind: 'idle' }
  | { readonly kind: 'reading' }
  | { readonly kind: 'failed'; readonly message: string };

export function ImageSeed() {
  const { setPalette } = useSystem();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Drag events fire for every child element crossed, so a plain boolean
  // flickers as the pointer moves over the grid. Counting enter/leave pairs
  // is what keeps the highlight steady.
  const dragDepth = useRef(0);

  const ingest = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        setStatus({ kind: 'failed', message: `${file.name} is not an image.` });
        return;
      }
      if (file.size > MAX_BYTES) {
        setStatus({
          kind: 'failed',
          message: 'That image is over 25MB — try a smaller version.',
        });
        return;
      }

      setStatus({ kind: 'reading' });
      try {
        const hexes = await extractPaletteFromImageFile(file, MAX_COLORS);
        if (hexes.length === 0) {
          setStatus({ kind: 'failed', message: 'No colours could be read from that image.' });
          return;
        }
        setPalette(hexes.map((hex) => ({ hex, oklch: parseColor(hex) })));
        setStatus({ kind: 'idle' });
      } catch (cause) {
        // The extractor throws with messages written for a person; anything
        // else is a decode failure, which needs its own wording rather than a
        // raw DOMException.
        setStatus({
          kind: 'failed',
          message:
            cause instanceof Error && cause.message !== ''
              ? cause.message
              : 'That file could not be read as an image.',
        });
      }
    },
    [setPalette]
  );

  useEffect(() => {
    function onDragEnter(event: DragEvent) {
      if (!hasFiles(event)) return;
      dragDepth.current += 1;
      setIsDragging(true);
    }
    function onDragOver(event: DragEvent) {
      if (!hasFiles(event)) return;
      // Without this the browser navigates to the file instead of dropping it.
      event.preventDefault();
    }
    function onDragLeave() {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setIsDragging(false);
    }
    function onDrop(event: DragEvent) {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepth.current = 0;
      setIsDragging(false);
      const file = event.dataTransfer?.files?.[0];
      if (file !== undefined) void ingest(file);
    }

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [ingest]);

  function handlePick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file !== undefined) void ingest(file);
    // Cleared so picking the same file twice still fires a change event.
    event.target.value = '';
  }

  return (
    <>
      <button
        type="button"
        className={styles.button}
        onClick={() => inputRef.current?.click()}
        disabled={status.kind === 'reading'}
      >
        {status.kind === 'reading' ? 'reading…' : '⇱ from image'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className={styles.input}
        onChange={handlePick}
        tabIndex={-1}
        aria-hidden="true"
      />

      {status.kind === 'failed' && (
        <p className={styles.error} role="status">
          {status.message}
        </p>
      )}

      {isDragging && (
        <div className={styles.dropVeil} aria-hidden="true">
          <span className={styles.dropLabel}>Drop an image to build a System from it</span>
        </div>
      )}
    </>
  );
}

/** True only for a drag carrying files, so dragging a swatch inside the app
 *  does not raise the whole-page drop veil. */
function hasFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types?.includes('Files') ?? false;
}
