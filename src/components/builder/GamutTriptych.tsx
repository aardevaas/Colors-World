'use client';

import { useMemo } from 'react';
import type { ScaleSpec } from '@/lib/color-engine';
import { compareAcrossGamuts } from '@/lib/harmony/gamut-compare';
import styles from './gamut-triptych.module.css';

/**
 * The same ramp, as three displays can actually show it.
 *
 * The per-step P3 and Rec2020 badges already say *which* steps exceed sRGB.
 * They cannot say what that costs, because the answer is not visible on the
 * screen doing the asking — a designer on a P3 laptop is looking at the wide
 * version while wondering about the narrow one.
 *
 * Rendering all three side by side answers it directly, and the finding worth
 * surfacing is not that steps shift. A whole ramp shifting together still
 * reads as a ramp. What breaks a ramp is two neighbouring steps arriving at
 * the same place, which is called out separately because it is the only part
 * a person has to act on.
 */

interface GamutTriptychProps {
  readonly spec: ScaleSpec;
}

const GAMUT_LABELS: Record<string, string> = {
  rec2020: 'Rec2020',
  p3: 'Display P3',
  srgb: 'sRGB',
};

const GAMUT_NOTES: Record<string, string> = {
  rec2020: 'the widest, what you drew',
  p3: 'most laptops and phones since ~2016',
  srgb: 'an older or cheaper monitor',
};

export function GamutTriptych({ spec }: GamutTriptychProps) {
  const comparison = useMemo(() => compareAcrossGamuts(spec), [spec]);
  const collapses = comparison.collapses;

  return (
    <section className={styles.triptych} aria-label="The same scale across display gamuts">
      <div className={styles.rows}>
        {comparison.gamuts.map((gamut, gamutIndex) => (
          <div key={gamut} className={styles.row}>
            <div className={styles.rowLabel}>
              <span className={styles.gamutName}>{GAMUT_LABELS[gamut] ?? gamut}</span>
              <span className={styles.gamutNote}>{GAMUT_NOTES[gamut] ?? ''}</span>
            </div>
            <ol className={styles.ramp}>
              {comparison.steps.map((step) => {
                const rendering = step.renderings[gamutIndex]!;
                const collapsedHere = collapses.some(
                  (c) => c.gamut === gamut && (c.lower === step.step || c.upper === step.step)
                );
                return (
                  <li
                    key={step.step}
                    className={styles.swatch}
                    style={{ background: rendering.hex }}
                    data-collapsed={collapsedHere}
                    title={`Step ${step.step} — ${rendering.hex}${
                      rendering.lossFromWidest > 0
                        ? `, ${rendering.lossFromWidest.toFixed(3)} from ${GAMUT_LABELS[comparison.widest]}`
                        : ''
                    }`}
                  >
                    <span className={styles.srOnly}>
                      Step {step.step} in {GAMUT_LABELS[gamut] ?? gamut}: {rendering.hex}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>

      {collapses.length === 0 ? (
        <p className={styles.verdict}>
          {comparison.shifting.length === 0
            ? 'This ramp sits inside sRGB — every display shows the same thing.'
            : `${comparison.shifting.length} of ${comparison.steps.length} steps shift on a narrower display, but the ramp keeps every step apart. Travelling through lightness is what buys that.`}
        </p>
      ) : (
        <div className={styles.damage}>
          <p className={styles.damageTitle}>
            {collapses.length === 1 ? 'One pair of steps merges' : `${collapses.length} pairs of steps merge`}{' '}
            on a narrower display
          </p>
          <ul className={styles.damageList}>
            {collapses.map((collapse) => (
              <li key={`${collapse.gamut}-${collapse.lower}`}>
                <span className={styles.mono}>
                  {collapse.lower} + {collapse.upper}
                </span>{' '}
                on {GAMUT_LABELS[collapse.gamut] ?? collapse.gamut} —{' '}
                <span className={styles.mono}>
                  {(collapse.widestDistance / Math.max(collapse.distance, 1e-6)).toFixed(0)}&times;
                </span>{' '}
                closer than you drew them
              </li>
            ))}
          </ul>
          <p className={styles.damageHint}>
            Give the ramp more lightness travel, or pull its chroma back, and the steps
            stay separate everywhere.
          </p>
        </div>
      )}
    </section>
  );
}
