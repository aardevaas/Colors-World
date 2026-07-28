'use client';

import { useState, type ReactNode } from 'react';
import {
  formatOklchCss,
  isInGamut,
  simulateCvd,
  type CvdType,
  type Gamut,
  type GeneratedScale,
} from '@/lib/color-engine';
import styles from './builder.module.css';

interface SwatchRowProps {
  readonly scale: GeneratedScale;
  readonly gamut: Gamut;
  readonly cvd: CvdType | 'none';
}

const WIDE_GAMUTS: readonly { readonly label: string; readonly gamut: Gamut }[] = [
  { label: 'P3', gamut: 'p3' },
  { label: 'Rec2020', gamut: 'rec2020' },
];

export function SwatchRow({ scale, gamut, cvd }: SwatchRowProps) {
  return (
    <div className={styles.swatchRow} role="list" aria-label={`${scale.name} scale swatches`}>
      {scale.steps.map((step) => {
        const displayed = cvd === 'none' ? step.oklch : simulateCvd(step.oklch, cvd);
        return (
          <Swatch key={step.step} background={formatOklchCss(displayed)} hex={step.hex}>
            <span className={styles.swatchStep}>{step.step}</span>
            {step.isAnchor && (
              <span className={styles.swatchAnchorMark} title="Primary Anchor for this scale">
                ★
              </span>
            )}
            <span className={styles.swatchHex}>{step.hex.toUpperCase()}</span>
            <div className={styles.swatchBadgeRow}>
              {step.gamutClamped && (
                <span className={styles.swatchBadge} title={`Riding the ${gamut} gamut ceiling`}>
                  clamped
                </span>
              )}
              {WIDE_GAMUTS.filter((g) => isInGamut(step.oklch, g.gamut)).map((g) => (
                <span key={g.gamut} className={styles.swatchBadge} data-wide="true">
                  {g.label}
                </span>
              ))}
            </div>
          </Swatch>
        );
      })}
    </div>
  );
}

interface SwatchProps {
  readonly background: string;
  readonly hex: string;
  readonly children: ReactNode;
}

const COPIED_FEEDBACK_MS = 1200;

function Swatch({ background, hex, children }: SwatchProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(hex);
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      // Clipboard access denied or unavailable — the swatch simply doesn't
      // show the "copied" confirmation rather than falsely claiming success.
    }
  }

  return (
    <button
      type="button"
      className={styles.swatch}
      style={{ background }}
      onClick={() => void handleCopy()}
      aria-label={`${hex} — click to copy`}
      data-copied={copied}
    >
      {children}
      <span className={styles.swatchCopyHint}>{copied ? 'copied' : 'copy'}</span>
    </button>
  );
}
