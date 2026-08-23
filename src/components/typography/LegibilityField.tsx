'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

  /*
   * ONE TAB STOP, NOT EIGHTY-ONE.
   *
   * Every cell is a button, so the grid put all 81 of them in the tab order:
   * this room measured 106 tab stops, of which 81 were one control. Reaching
   * the "Ways out" list underneath meant pressing Tab eighty-one times through
   * a table you can already read at a glance, and anyone driving by keyboard
   * simply could not get past it.
   *
   * The grid keyboard pattern instead: exactly one cell is tabbable, arrows
   * move between them, Enter and Space pick — which is also how a spreadsheet
   * behaves, so it needs no explaining. The tabbable one is the marker,
   * because that is the cell someone tabbing in wants to start from.
   */
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const [roving, setRoving] = useState<readonly [number, number] | null>(null);

  const currentAt = useMemo<readonly [number, number] | null>(() => {
    for (let r = 0; r < field.rows.length; r += 1) {
      const c = field.rows[r]!.findIndex(
        (cell) => Math.abs(cell.px - fontSizePx) < 0.51 && cell.weight === fontWeight
      );
      if (c !== -1) return [r, c];
    }
    return null;
  }, [field, fontSizePx, fontWeight]);

  // The setting moved — from a slider, a "ways out" button, or a pick in here.
  // The tab stop follows the marker rather than stranding it somewhere stale.
  useEffect(() => {
    setRoving(null);
  }, [fontSizePx, fontWeight]);

  const active = roving ?? currentAt ?? ([0, 0] as const);

  const moveFocus = useCallback(
    (r: number, c: number) => {
      const rows = field.rows.length;
      const cols = field.rows[0]?.length ?? 0;
      if (rows === 0 || cols === 0) return;
      const nr = Math.min(rows - 1, Math.max(0, r));
      const nc = Math.min(cols - 1, Math.max(0, c));
      setRoving([nr, nc]);
      // After the re-render that moves tabIndex, or the browser refuses focus.
      requestAnimationFrame(() => {
        bodyRef.current
          ?.querySelector<HTMLButtonElement>(`[data-cell="${nr}-${nc}"]`)
          ?.focus();
      });
    },
    [field]
  );

  function handleCellKey(event: React.KeyboardEvent<HTMLButtonElement>, r: number, c: number) {
    const cols = field.rows[0]?.length ?? 0;
    const rows = field.rows.length;
    switch (event.key) {
      case 'ArrowRight': moveFocus(r, c + 1); break;
      case 'ArrowLeft': moveFocus(r, c - 1); break;
      case 'ArrowDown': moveFocus(r + 1, c); break;
      case 'ArrowUp': moveFocus(r - 1, c); break;
      case 'Home': moveFocus(event.ctrlKey ? 0 : r, 0); break;
      case 'End': moveFocus(event.ctrlKey ? rows - 1 : r, cols - 1); break;
      default: return;
    }
    event.preventDefault();
  }

  const verdictCopy = {
    'passes-everywhere': 'Carries body text at any size and weight.',
    'passes-when-large': 'Carries large text only — the shaded region.',
    'passes-nowhere': 'No way of setting type rescues this pair. Only color will.',
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
            Size across, weight down. Click any cell to set the specimen to it —
            or arrow around the grid and press Enter.
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
          <tbody ref={bodyRef}>
            {field.rows.map((row, i) => {
              const weight = field.weights[i]!;
              return (
                <tr key={weight}>
                  <th scope="row">{weight}</th>
                  {row.map((cell, j) => {
                    const isCurrent =
                      Math.abs(cell.px - fontSizePx) < 0.51 && cell.weight === fontWeight;
                    return (
                      <td key={cell.px} className={styles.cellWrap}>
                        <button
                          type="button"
                          className={cell.passes ? styles.cellPass : styles.cellFail}
                          data-current={isCurrent}
                          data-cell={`${i}-${j}`}
                          tabIndex={active[0] === i && active[1] === j ? 0 : -1}
                          onKeyDown={(event) => handleCellKey(event, i, j)}
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
            {exits.recolor.status === 'already-passes' && 'Color — nothing to change'}
            {exits.recolor.status === 'recolor' && (
              <>
                Color — <span className={styles.mono}>{exits.recolor.hex}</span>
              </>
            )}
            {exits.recolor.status === 'thicken' &&
              `Color — unchanged; weight ${exits.recolor.weight} is enough`}
            {exits.recolor.status === 'unreachable' &&
              `Color — unreachable at any lightness, best ${exits.recolor.bestRatio.toFixed(2)}:1`}
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
