'use client';

import { useMemo } from 'react';
import type { Oklch } from '@/lib/color-engine';
import { buildLegibilityField, findExits } from '@/lib/typography/legibility-field';
import styles from './legibility-field.module.css';

/**
 * The Legibility Solver, on screen.
 *
 * A contrast checker tells you a pair fails. This tells you *where* it fails,
 * which is a different and more useful thing, because the requirement depends
 * on how the type is set. The grid is size across, weight down, shaded where
 * the current pair carries text — and the marker sits on the setting actually
 * in use, so a failure reads as a position with visible ways out rather than
 * as a red number.
 *
 * The shape people are surprised by is the corner: below 18.66px the whole
 * column is uniform, because no amount of weight changes what the standard
 * asks for. Seeing that once is worth more than reading it.
 */

interface LegibilityFieldProps {
  readonly text: Oklch;
  readonly background: Oklch;
  readonly fontSizePx: number;
  readonly fontWeight: number;
  readonly onPick: (px: number, weight: number) => void;
}

export function LegibilityField({
  text,
  background,
  fontSizePx,
  fontWeight,
  onPick,
}: LegibilityFieldProps) {
  const field = useMemo(() => buildLegibilityField(text, background), [text, background]);
  const exits = useMemo(
    () => findExits(text, background, fontSizePx, fontWeight),
    [text, background, fontSizePx, fontWeight]
  );

  const verdictCopy = {
    'passes-everywhere': 'Carries body text at any size and weight.',
    'passes-when-large': 'Carries large text only — the shaded region.',
    'passes-nowhere': 'No way of setting type rescues this pair. Only colour will.',
  }[field.verdict];

  return (
    <div className={styles.field}>
      <div className={styles.summary}>
        <span className={styles.ratio}>{field.ratio.toFixed(2)}:1</span>
        <span className={styles.apca}>APCA {Math.round(field.apcaLc)}</span>
        <span className={styles.verdict}>{verdictCopy}</span>
      </div>

      <div className={styles.gridScroll}>
        <table className={styles.grid}>
          <caption className={styles.caption}>
            Size across, weight down. Click any cell to set the specimen to it.
          </caption>
          <thead>
            <tr>
              <th scope="col" className={styles.corner}>
                <abbr title="Weight, down. Size, across.">w&#8595;&nbsp;s&#8594;</abbr>
              </th>
              {field.sizes.map((px) => (
                <th key={px} scope="col">
                  {px}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {field.rows.map((row, i) => {
              const weight = field.weights[i]!;
              return (
                <tr key={weight}>
                  <th scope="row">{weight}</th>
                  {row.map((cell) => {
                    const isCurrent =
                      Math.abs(cell.px - fontSizePx) < 0.51 && cell.weight === fontWeight;
                    return (
                      <td key={cell.px} className={styles.cellWrap}>
                        <button
                          type="button"
                          className={cell.passes ? styles.cellPass : styles.cellFail}
                          data-current={isCurrent}
                          onClick={() => onPick(cell.px, cell.weight)}
                          aria-label={`${cell.px}px at weight ${cell.weight}: needs ${cell.required}:1, pair is ${field.ratio.toFixed(2)}:1 — ${cell.passes ? 'passes' : 'fails'}`}
                        >
                          {cell.passes ? '✓' : '·'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={styles.exits}>
        <span className={styles.exitsLabel}>Ways out</span>
        <ul className={styles.exitList}>
          <li className={exits.grow === null ? styles.exitOff : styles.exitOn}>
            {exits.grow === null ? 'Larger — no size helps' : `Larger — ${exits.grow}px`}
            {exits.grow !== null && (
              <button
                type="button"
                className={styles.exitButton}
                onClick={() => onPick(exits.grow!, fontWeight)}
              >
                apply
              </button>
            )}
          </li>
          <li className={exits.thicken === null ? styles.exitOff : styles.exitOn}>
            {exits.thicken === null
              ? 'Heavier — no weight helps at this size'
              : `Heavier — ${exits.thicken}`}
            {exits.thicken !== null && (
              <button
                type="button"
                className={styles.exitButton}
                onClick={() => onPick(fontSizePx, exits.thicken!)}
              >
                apply
              </button>
            )}
          </li>
          <li className={styles.exitOn}>
            {exits.recolour.status === 'already-passes' && 'Colour — nothing to change'}
            {exits.recolour.status === 'recolour' && (
              <>
                Colour — <span className={styles.mono}>{exits.recolour.hex}</span>
              </>
            )}
            {exits.recolour.status === 'thicken' &&
              `Colour — unchanged; weight ${exits.recolour.weight} is enough`}
            {exits.recolour.status === 'unreachable' &&
              `Colour — unreachable at any lightness, best ${exits.recolour.bestRatio.toFixed(2)}:1`}
          </li>
        </ul>
        {exits.thicken === null && exits.grow !== null && (
          <p className={styles.note}>
            Below 18.66px the standard ignores weight entirely, so thickening small
            text changes nothing it measures.
          </p>
        )}
      </div>
    </div>
  );
}
