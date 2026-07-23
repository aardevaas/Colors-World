'use client';

import { useMemo } from 'react';
import {
  auditContrast,
  bestTextColor,
  formatHex,
  formatOklchCss,
  parseColor,
  simulateCvd,
  type CvdType,
  type ScaleStep,
} from '@/lib/color-engine';
import { ColorValues } from '@/components/color-values/ColorValues';
import styles from './scale-lab.module.css';

const PURE_BLACK = parseColor('#000000');
const PURE_WHITE = parseColor('#ffffff');

export type CvdMode = CvdType | 'none';

interface ScaleColumnProps {
  readonly step: ScaleStep;
  readonly cvd: CvdMode;
  readonly pinned: boolean;
}

export function ScaleColumn({ step, cvd, pinned }: ScaleColumnProps) {
  const view = useMemo(() => {
    // The swatch shows the simulated colour so the eye can compare directly,
    // but every number in the readout still describes the *real* colour —
    // conflating the two would make the panel lie about what you'd ship.
    const displayed =
      cvd === 'none' ? step.oklch : simulateCvd(step.oklch, cvd);
    const ink = bestTextColor(displayed, [PURE_BLACK, PURE_WHITE]);
    const onWhite = auditContrast(step.oklch, PURE_WHITE);
    const onBlack = auditContrast(step.oklch, PURE_BLACK);

    return {
      background: formatOklchCss(displayed),
      ink: formatHex(ink),
      onWhite,
      onBlack,
    };
  }, [step.oklch, cvd]);

  const { l, c, h } = step.oklch;

  return (
    <div
      className={styles.column}
      style={{ background: view.background, color: view.ink }}
      data-anchor={step.isAnchor}
      data-pinned={pinned}
      role="group"
      aria-label={`Step ${step.step}, ${step.hex}`}
    >
      <div className={styles.badgeRow}>
        {step.isAnchor && <span className={styles.badge}>pinned</span>}
        {step.gamutClamped && <span className={styles.badge}>clamped</span>}
      </div>

      <span className={styles.stepIndex}>{step.step}</span>

      <div className={styles.stepReadout}>
        <ColorValues oklch={step.oklch} />
        <dl className={styles.stepContrast}>
          <div>
            L {(l * 100).toFixed(1)} · C {c.toFixed(3)} · H {h.toFixed(1)}
          </div>
          <div>
            on white {view.onWhite.ratio.toFixed(2)}:1
            {view.onWhite.normalText.aa ? ' AA' : ''}
          </div>
          <div>
            on black {view.onBlack.ratio.toFixed(2)}:1
            {view.onBlack.normalText.aa ? ' AA' : ''}
          </div>
          <div>Lc {view.onWhite.apcaLc.toFixed(0)}</div>
        </dl>
      </div>
    </div>
  );
}
