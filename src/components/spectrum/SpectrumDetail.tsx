'use client';

import { ColorValues } from '@/components/color-values/ColorValues';
import type { GeneratedSwatch } from '@/lib/spectrum/generate-color';
import { hueFamilyName } from '@/lib/spectrum/hue-family';
import styles from './spectrum.module.css';

interface SpectrumDetailProps {
  readonly swatch: GeneratedSwatch;
  readonly collected: boolean;
  readonly onToggleCollect: (swatch: GeneratedSwatch) => void;
  readonly onClose: () => void;
}

export function SpectrumDetail({
  swatch,
  collected,
  onToggleCollect,
  onClose,
}: SpectrumDetailProps) {
  return (
    <aside className={styles.detail}>
      <div className={styles.detailSwatch} style={{ background: swatch.hex }} />
      <div className={styles.detailBody}>
        <button
          type="button"
          className={styles.detailClose}
          onClick={onClose}
          aria-label="Close detail"
        >
          ×
        </button>
        <h2 className={styles.detailName}>{swatch.hex.toUpperCase()}</h2>
        <p className={styles.detailMeta}>
          {hueFamilyName(swatch.oklch.h)} · position {swatch.index.toLocaleString()}
        </p>

        <ColorValues oklch={swatch.oklch} />

        <div className={styles.detailActions}>
          <button
            type="button"
            className={styles.tab}
            aria-pressed={collected}
            onClick={() => onToggleCollect(swatch)}
          >
            {collected ? '♥ collected' : '♡ collect'}
          </button>
        </div>
      </div>
    </aside>
  );
}
