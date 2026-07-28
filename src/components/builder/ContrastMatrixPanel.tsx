'use client';

import { Fragment, useMemo, useState } from 'react';
import { buildContrastMatrix, type GeneratedScale } from '@/lib/color-engine';
import styles from './builder.module.css';

interface ContrastMatrixPanelProps {
  readonly scales: readonly GeneratedScale[];
  readonly open: boolean;
  readonly onToggle: () => void;
}

const AA_NORMAL_TEXT_RATIO = 4.5;

interface HoverCell {
  readonly rowIndex: number;
  readonly colIndex: number;
}

export function ContrastMatrixPanel({ scales, open, onToggle }: ContrastMatrixPanelProps) {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [hoverCell, setHoverCell] = useState<HoverCell | null>(null);

  const activeScale = scales.find((s) => s.name === selectedName) ?? scales[0] ?? null;

  // Computed only while the accordion is open — a real cost gate, not just
  // a CSS collapse, per the spec's "non-intrusive" framing.
  const matrix = useMemo(
    () => (open && activeScale !== null ? buildContrastMatrix(activeScale.steps) : null),
    [open, activeScale]
  );

  return (
    <section className={styles.matrixPanel}>
      <button
        type="button"
        className={styles.matrixToggle}
        onClick={onToggle}
        aria-expanded={open}
      >
        {open ? '▾' : '▸'} View Contrast Matrix
      </button>

      {open && activeScale !== null && matrix !== null && (
        <div className={styles.matrixBody}>
          {scales.length > 1 && (
            <select
              className={styles.matrixScaleSelect}
              value={activeScale.name}
              onChange={(event) => setSelectedName(event.target.value)}
              aria-label="Scale to score"
            >
              {scales.map((scale) => (
                <option key={scale.name} value={scale.name}>
                  {scale.name}
                </option>
              ))}
            </select>
          )}

          <p className={styles.matrixAxisNote}>
            rows = text &middot; columns = background &middot; WCAG ratio (compliance) over APCA Lc
            (advisory)
          </p>

          <div
            className={styles.matrixGrid}
            style={{ gridTemplateColumns: `auto repeat(${matrix.stepIndices.length}, 1fr)` }}
          >
            <div className={styles.matrixCorner} />
            {matrix.stepIndices.map((stepIndex) => (
              <div
                key={`col-${stepIndex}`}
                className={styles.matrixAxisSwatch}
                style={{ background: activeScale.steps[stepIndex]?.hex }}
                title={`background: step ${stepIndex}`}
              />
            ))}

            {matrix.rows.map((row, rowIndex) => (
              <Fragment key={`row-${matrix.stepIndices[rowIndex]}`}>
                <div
                  className={styles.matrixAxisSwatch}
                  style={{ background: activeScale.steps[rowIndex]?.hex }}
                  title={`text: step ${rowIndex}`}
                />
                {row.map((cell, colIndex) => {
                  const passesAA = cell.ratio >= AA_NORMAL_TEXT_RATIO;
                  const isHighlighted =
                    hoverCell !== null &&
                    (hoverCell.rowIndex === rowIndex || hoverCell.colIndex === colIndex);
                  return (
                    <button
                      key={`${rowIndex}-${colIndex}`}
                      type="button"
                      className={styles.matrixCell}
                      data-pass={passesAA}
                      data-highlighted={isHighlighted}
                      onMouseEnter={() => setHoverCell({ rowIndex, colIndex })}
                      onMouseLeave={() => setHoverCell(null)}
                      title={`text step ${cell.textStep} on background step ${cell.backgroundStep} — ${cell.ratio.toFixed(2)}:1, APCA Lc ${cell.apcaLc.toFixed(0)}`}
                    >
                      <span className={styles.matrixRatio}>{cell.ratio.toFixed(1)}</span>
                      <span className={styles.matrixApca}>{cell.apcaLc.toFixed(0)}</span>
                    </button>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
