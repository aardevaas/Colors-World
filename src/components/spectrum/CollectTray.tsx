'use client';

import { useState } from 'react';
import { pinColorAction } from '@/app/actions';
import type { GeneratedSwatch } from '@/lib/spectrum/generate-color';
import styles from './spectrum.module.css';

interface CollectTrayProps {
  readonly swatches: readonly GeneratedSwatch[];
  readonly onRemove: (swatch: GeneratedSwatch) => void;
  readonly onClose: () => void;
}

/**
 * The heart-as-you-scroll tray lives in localStorage — it's a scratch space
 * for a browsing session, not the system of record. "Pin to wall" is the
 * bridge into the real per-project Studio Wall, where a colour becomes a
 * persistent card rather than something that evaporates when the tab closes.
 */
export function CollectTray({ swatches, onRemove, onClose }: CollectTrayProps) {
  const [pinning, setPinning] = useState(false);
  const [pinnedCount, setPinnedCount] = useState<number | null>(null);

  async function handlePinAll() {
    setPinning(true);
    setPinnedCount(null);
    try {
      for (const swatch of swatches) {
        await pinColorAction(swatch.hex);
      }
      setPinnedCount(swatches.length);
    } finally {
      setPinning(false);
    }
  }

  return (
    <div className={styles.tray}>
      <div className={styles.trayHead}>
        <span>{swatches.length} collected</span>
        <button type="button" className={styles.detailClose} onClick={onClose} aria-label="Close tray">
          ×
        </button>
      </div>
      {swatches.length === 0 ? (
        <p className={styles.trayEmpty}>Heart a colour as you scroll to collect it here.</p>
      ) : (
        <>
          <div className={styles.trayGrid}>
            {swatches.map((swatch) => (
              <button
                key={swatch.index}
                type="button"
                className={styles.trayItem}
                style={{ background: swatch.hex }}
                onClick={() => onRemove(swatch)}
                aria-label={`Remove ${swatch.hex}`}
                title={swatch.hex}
              />
            ))}
          </div>
          <button
            type="button"
            className={styles.trayPinButton}
            onClick={() => void handlePinAll()}
            disabled={pinning}
          >
            {pinning ? 'Pinning…' : `Pin ${swatches.length === 1 ? 'colour' : 'all'} to Studio Wall`}
          </button>
          {pinnedCount !== null && (
            <p className={styles.trayPinnedNote}>Pinned {pinnedCount} to the wall — see it at /</p>
          )}
        </>
      )}
    </div>
  );
}
