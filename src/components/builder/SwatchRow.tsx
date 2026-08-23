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
          <Swatch
            key={step.step}
            background={formatOklchCss(displayed)}
            hex={step.hex}
            /*
             * The step's own lightness decides which way its labels read.
             *
             * The hex and gamut chips sat on a fixed 35–40% black scrim with
             * near-white text, which works over the dark half of a ramp and
             * fails over the light half — measured from 2.42:1 at the top of a
             * blue scale, where 4.5:1 is required. A scrim heavy enough to
             * rescue white text over a near-white swatch is about 84% black,
             * which is a black box sitting on the colour you came to look at.
             * So the chips flip instead, which is what this room is for.
             */
            isLight={displayed.l > 0.62}
          >
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
  /** Whether this step is light enough that its labels must run dark. */
  readonly isLight: boolean;
  readonly children: ReactNode;
}

const COPIED_FEEDBACK_MS = 1200;

function Swatch({ background, hex, isLight, children }: SwatchProps) {
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
      data-on-light={isLight}
      onClick={() => void handleCopy()}
      aria-label={`${hex} — click to copy`}
      data-copied={copied}
    >
      {children}
      <span className={styles.swatchCopyHint}>{copied ? 'copied' : 'copy'}</span>
    </button>
  );
}
