'use client';

import { useState } from 'react';
import { pinColorAction } from '@/app/actions';
import type { SpectrumRow } from '@/lib/supabase/colors';
import styles from './spectrum.module.css';

interface CollectTrayProps {
  readonly rows: readonly SpectrumRow[];
  readonly onRemove: (row: SpectrumRow) => void;
  readonly onClose: () => void;
}

/**
 * The heart-as-you-scroll tray lives in localStorage — it's a scratch space
 * for a browsing session, not the system of record. "Pin to wall" is the
 * bridge into the real per-project Studio Wall, where a colour becomes a
 * persistent card rather than something that evaporates when the tab closes.
 */
export function CollectTray({ rows, onRemove, onClose }: CollectTrayProps) {
  const [pinning, setPinning] = useState(false);
  const [pinnedCount, setPinnedCount] = useState<number | null>(null);

  async function handlePinAll() {
    setPinning(true);
    setPinnedCount(null);
    try {
      for (const row of rows) {
        await pinColorAction(row.hex, row.name);
      }
      setPinnedCount(rows.length);
    } finally {
      setPinning(false);
    }
  }

  return (
    <div className={styles.tray}>
      <div className={styles.trayHead}>
        <span>{rows.length} collected</span>
        <button type="button" className={styles.detailClose} onClick={onClose} aria-label="Close tray">
          ×
        </button>
      </div>
      {rows.length === 0 ? (
        <p className={styles.trayEmpty}>Heart a colour as you scroll to collect it here.</p>
      ) : (
        <>
          <div className={styles.trayGrid}>
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                className={styles.trayItem}
                style={{ background: row.hex }}
                onClick={() => onRemove(row)}
                aria-label={`Remove ${row.name}`}
                title={row.name}
              />
            ))}
          </div>
          <button
            type="button"
            className={styles.trayPinButton}
            onClick={() => void handlePinAll()}
            disabled={pinning}
          >
            {pinning ? 'Pinning…' : `Pin ${rows.length === 1 ? 'colour' : 'all'} to Studio Wall`}
          </button>
          {pinnedCount !== null && (
            <p className={styles.trayPinnedNote}>Pinned {pinnedCount} to the wall — see it at /</p>
          )}
        </>
      )}
    </div>
  );
}
