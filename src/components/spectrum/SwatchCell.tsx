'use client';

import type { SpectrumRow } from '@/lib/supabase/colors';
import styles from './spectrum.module.css';

interface SwatchCellProps {
  readonly row: SpectrumRow;
  readonly collected: boolean;
  readonly onSelect: (row: SpectrumRow) => void;
  readonly onToggleCollect: (row: SpectrumRow) => void;
}

export function SwatchCell({ row, collected, onSelect, onToggleCollect }: SwatchCellProps) {
  return (
    <div
      className={styles.cell}
      style={{ background: row.hex }}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(row)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(row);
        }
      }}
      aria-label={row.name}
    >
      <button
        type="button"
        className={styles.heart}
        data-collected={collected}
        onClick={(event) => {
          event.stopPropagation();
          onToggleCollect(row);
        }}
        aria-label={collected ? `Remove ${row.name} from tray` : `Collect ${row.name}`}
        aria-pressed={collected}
      >
        {collected ? '♥' : '♡'}
      </button>
    </div>
  );
}
