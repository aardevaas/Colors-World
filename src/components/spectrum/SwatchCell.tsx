'use client';

import type { GeneratedSwatch } from '@/lib/spectrum/generate-color';
import styles from './spectrum.module.css';

interface SwatchCellProps {
  readonly swatch: GeneratedSwatch;
  readonly collected: boolean;
  readonly onSelect: (swatch: GeneratedSwatch) => void;
  readonly onToggleCollect: (swatch: GeneratedSwatch) => void;
}

export function SwatchCell({ swatch, collected, onSelect, onToggleCollect }: SwatchCellProps) {
  return (
    <div
      className={styles.cell}
      style={{ background: swatch.hex }}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(swatch)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(swatch);
        }
      }}
      aria-label={swatch.hex}
    >
      <button
        type="button"
        className={styles.heart}
        data-collected={collected}
        onClick={(event) => {
          event.stopPropagation();
          onToggleCollect(swatch);
        }}
        aria-label={collected ? `Remove ${swatch.hex} from tray` : `Collect ${swatch.hex}`}
        aria-pressed={collected}
      >
        {collected ? '♥' : '♡'}
      </button>
    </div>
  );
}
