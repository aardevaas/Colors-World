'use client';

import { useMemo, useState } from 'react';
import {
  formatHex,
  formatOklchCss,
  parseColor,
  type Oklch,
} from '@/lib/color-engine';
import { blendOklch, deltaEOk, type MergeConflict } from '@/lib/versioning';
import styles from './merge-lab.module.css';

interface ConflictRowProps {
  readonly conflict: MergeConflict;
  readonly resolution: string | null;
  readonly onResolve: (token: string, value: string) => void;
}

type Pick = 'base' | 'ours' | 'theirs' | 'blend';

export function ConflictRow({ conflict, resolution, onResolve }: ConflictRowProps) {
  const [blendT, setBlendT] = useState(0.5);

  const { oursOklch, theirsOklch, magnitude } = useMemo(() => {
    // A modify/delete conflict has no color on one side — blending needs
    // both, so it falls back to the surviving side rather than crashing.
    const ours = conflict.ours === null ? null : parseColor(conflict.ours);
    const theirs = conflict.theirs === null ? null : parseColor(conflict.theirs);
    return {
      oursOklch: ours,
      theirsOklch: theirs,
      magnitude: ours !== null && theirs !== null ? deltaEOk(ours, theirs) : null,
    };
  }, [conflict.ours, conflict.theirs]);

  const blended: Oklch | null =
    oursOklch !== null && theirsOklch !== null
      ? blendOklch(oursOklch, theirsOklch, blendT)
      : null;

  const activePick: Pick | null = useMemo(() => {
    if (resolution === null) return null;
    if (resolution === conflict.base) return 'base';
    if (resolution === conflict.ours) return 'ours';
    if (resolution === conflict.theirs) return 'theirs';
    return 'blend';
  }, [resolution, conflict]);

  return (
    <div className={styles.conflict} data-resolved={resolution !== null}>
      <div className={styles.conflictHeader}>
        <span className={styles.tokenName}>{conflict.token}</span>
        <span className={styles.resolvedTag} data-active={resolution !== null}>
          {resolution !== null ? 'resolved' : 'unresolved'}
        </span>
      </div>

      <div className={styles.swatchRow}>
        <ColorSwatch
          label="base"
          value={conflict.base}
          pressed={activePick === 'base'}
          onSelect={() => conflict.base !== null && onResolve(conflict.token, conflict.base)}
        />
        <ColorSwatch
          label="ours"
          value={conflict.ours}
          pressed={activePick === 'ours'}
          onSelect={() => conflict.ours !== null && onResolve(conflict.token, conflict.ours)}
        />
        <ColorSwatch
          label="theirs"
          value={conflict.theirs}
          pressed={activePick === 'theirs'}
          onSelect={() => conflict.theirs !== null && onResolve(conflict.token, conflict.theirs)}
        />
      </div>

      {blended !== null && (
        <div className={styles.blendSection}>
          <div className={styles.blendRow}>
            <div
              className={styles.blendPreview}
              style={{ background: formatOklchCss(blended) }}
            />
            <input
              type="range"
              className={styles.blendSlider}
              min={0}
              max={1}
              step={0.01}
              value={blendT}
              onChange={(event) => {
                const t = Number(event.target.value);
                setBlendT(t);
                onResolve(conflict.token, formatHex(blendOklch(oursOklch!, theirsOklch!, t)));
              }}
              aria-label={`Blend between ours and theirs for ${conflict.token}`}
            />
            <span className={styles.blendReadout}>{formatHex(blended)}</span>
          </div>
          {magnitude !== null && (
            <span className={styles.metaLine}>
              ours ↔ theirs · ΔE-OK {magnitude.toFixed(3)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface ColorSwatchProps {
  readonly label: string;
  readonly value: string | null;
  readonly pressed: boolean;
  readonly onSelect: () => void;
}

function ColorSwatch({ label, value, pressed, onSelect }: ColorSwatchProps) {
  if (value === null) {
    return (
      <button type="button" className={styles.swatch} disabled aria-pressed={false}>
        <span className={styles.swatchLabel}>{label}</span>
        <span className={styles.swatchHex}>&lt;deleted&gt;</span>
      </button>
    );
  }

  const oklch = parseColor(value);
  const ink = oklch.l > 0.6 ? '#0a0a0a' : '#f5f5f5';

  return (
    <button
      type="button"
      className={styles.swatch}
      style={{ background: value, color: ink }}
      aria-pressed={pressed}
      onClick={onSelect}
    >
      <span className={styles.swatchLabel}>{label}</span>
      <span className={styles.swatchHex}>{value.toUpperCase()}</span>
    </button>
  );
}
