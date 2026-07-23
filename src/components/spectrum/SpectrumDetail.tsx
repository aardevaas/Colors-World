'use client';

import Link from 'next/link';
import { ColorValues } from '@/components/color-values/ColorValues';
import type { SpectrumRow } from '@/lib/supabase/colors';
import { hueFamilyName } from '@/lib/spectrum/hue-family';
import styles from './spectrum.module.css';

interface SpectrumDetailProps {
  readonly row: SpectrumRow;
  readonly collected: boolean;
  readonly onToggleCollect: (row: SpectrumRow) => void;
  readonly onClose: () => void;
}

export function SpectrumDetail({
  row,
  collected,
  onToggleCollect,
  onClose,
}: SpectrumDetailProps) {
  return (
    <aside className={styles.detail}>
      <div className={styles.detailSwatch} style={{ background: row.hex }} />
      <div className={styles.detailBody}>
        <button
          type="button"
          className={styles.detailClose}
          onClick={onClose}
          aria-label="Close detail"
        >
          ×
        </button>
        <h2 className={styles.detailName}>{row.name}</h2>
        <p className={styles.detailMeta}>
          {hueFamilyName(row.oklch.h)} · position {row.spectrumIndex.toLocaleString()}
        </p>

        <ColorValues oklch={row.oklch} />

        <div className={styles.detailActions}>
          <button
            type="button"
            className={styles.tab}
            aria-pressed={collected}
            onClick={() => onToggleCollect(row)}
          >
            {collected ? '♥ collected' : '♡ collect'}
          </button>
          <Link href={`/library/${row.id}`} className={styles.tab}>
            full detail →
          </Link>
        </div>
      </div>
    </aside>
  );
}
