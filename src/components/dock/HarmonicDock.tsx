'use client';

import { useState, type DragEvent } from 'react';
import { useDock } from '@/lib/dock/dock-context';
import { formatHex } from '@/lib/color-engine';
import { readSwatchDragPayload } from '@/lib/dock/drag-payload';
import styles from './harmonic-dock.module.css';

/**
 * The Floating Harmonic Collector Dock — mounted once in the root layout
 * (see app/layout.tsx), so it persists across every route the way the
 * spec asks for, unlike the old per-page Spectrum tray it supersedes.
 *
 * Renders nothing at all when empty rather than an empty collapsed pill —
 * a permanent fixture on every page of the app for someone who has never
 * collected a colour is exactly the kind of default-visible chrome the
 * rest of this app has deliberately avoided (see the landing page's own
 * "nothing exists until you've earned it" reveal pattern).
 */
export function HarmonicDock() {
  const { items, primaryAnchorHex, addToDock, removeFromDock, setPrimaryAnchor } = useDock();
  const [expanded, setExpanded] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  if (items.length === 0) return null;

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragOver(false);
    const payload = readSwatchDragPayload(event);
    if (payload !== null) addToDock(payload.hex, payload.oklch);
  }

  if (!expanded) {
    return (
      <button
        type="button"
        className={styles.collapsedPill}
        onClick={() => setExpanded(true)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-drag-over={dragOver}
        aria-label={`Open Harmonic Dock — ${items.length} colour${items.length === 1 ? '' : 's'} collected`}
      >
        <span className={styles.stack} aria-hidden="true">
          {items.slice(-5).map((item) => (
            <span
              key={item.hex}
              className={styles.stackSwatch}
              style={{ background: item.hex }}
            />
          ))}
        </span>
        <span className={styles.count}>{items.length}</span>
      </button>
    );
  }

  return (
    <div
      className={styles.panel}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-drag-over={dragOver}
      role="region"
      aria-label="Harmonic Dock"
    >
      <header className={styles.panelHead}>
        <span className={styles.panelTitle}>
          Harmonic Dock <span className={styles.panelCount}>· {items.length}</span>
        </span>
        <button
          type="button"
          className={styles.collapseButton}
          onClick={() => setExpanded(false)}
          aria-label="Collapse dock"
        >
          ×
        </button>
      </header>

      <div className={styles.itemRow}>
        {items.map((item) => {
          const isAnchor = item.hex === primaryAnchorHex;
          return (
            <div key={item.hex} className={styles.item} data-anchor={isAnchor}>
              <button
                type="button"
                className={styles.swatch}
                style={{ background: item.hex }}
                onClick={() => setPrimaryAnchor(item.hex)}
                title={isAnchor ? `${formatHex(item.oklch)} — Primary Anchor` : formatHex(item.oklch)}
                aria-label={
                  isAnchor
                    ? `${item.hex}, Primary Anchor`
                    : `${item.hex}. Set as Primary Anchor`
                }
                aria-pressed={isAnchor}
              >
                {isAnchor && <span className={styles.anchorMark} aria-hidden="true">★</span>}
              </button>
              <button
                type="button"
                className={styles.removeButton}
                onClick={() => removeFromDock(item.hex)}
                aria-label={`Remove ${item.hex} from dock`}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {/* /builder doesn't exist yet (brief §8 route migration) — disabled
          with an honest reason rather than a link that would 404. */}
      <button type="button" className={styles.scaleLabButton} disabled title="Scale Lab (/builder) is not built yet">
        Open in Scale Lab
      </button>
    </div>
  );
}
