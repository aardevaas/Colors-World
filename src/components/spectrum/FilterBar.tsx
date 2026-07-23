'use client';

import { HUE_FAMILIES } from '@/lib/spectrum/hue-family';
import type { ChromaBand, LightnessBand, SpectrumFilterSelection } from '@/lib/spectrum/filters';
import styles from './spectrum.module.css';

interface FilterBarProps {
  readonly selection: SpectrumFilterSelection;
  readonly onChange: (next: SpectrumFilterSelection) => void;
  readonly collectedCount: number;
  readonly onOpenTray: () => void;
}

export function FilterBar({ selection, onChange, collectedCount, onOpenTray }: FilterBarProps) {
  return (
    <div className={styles.filterBar}>
      <select
        className={styles.filterSelect}
        value={selection.hueFamily}
        onChange={(event) => onChange({ ...selection, hueFamily: event.target.value })}
        aria-label="Hue family"
      >
        <option value="all">all hues</option>
        {HUE_FAMILIES.map((family) => (
          <option key={family.name} value={family.name}>
            {family.name}
          </option>
        ))}
      </select>

      <select
        className={styles.filterSelect}
        value={selection.lightnessBand}
        onChange={(event) =>
          onChange({ ...selection, lightnessBand: event.target.value as LightnessBand })
        }
        aria-label="Lightness band"
      >
        <option value="all">any lightness</option>
        <option value="pastel">pastel</option>
        <option value="deep">deep</option>
      </select>

      <select
        className={styles.filterSelect}
        value={selection.chromaBand}
        onChange={(event) =>
          onChange({ ...selection, chromaBand: event.target.value as ChromaBand })
        }
        aria-label="Chroma band"
      >
        <option value="all">any saturation</option>
        <option value="muted">muted</option>
        <option value="vivid">vivid</option>
      </select>

      <button type="button" className={styles.trayButton} onClick={onOpenTray}>
        ♥ {collectedCount}
      </button>
    </div>
  );
}
