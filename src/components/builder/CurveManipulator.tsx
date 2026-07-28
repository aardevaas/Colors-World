'use client';

import { useRef, useState, type PointerEvent } from 'react';
import type { ControlPoint } from '@/lib/color-engine';
import styles from './builder.module.css';

/**
 * A fixed 5-handle curve editor (x pinned at 0, 0.25, 0.5, 0.75, 1 —
 * normalized progress across the scale) — the "Smooth OKLCH Curve Handles"
 * from the /builder spec. Fixed x-positions rather than freeform point
 * insertion/deletion keeps this a scoped, real interaction instead of a
 * general bezier-node editor; five points is enough to shape a genuinely
 * expressive ramp while staying simple to drag on a touch target.
 *
 * Draws with straight polyline segments between handles — an honest visual
 * approximation of "an editable curve," not a render of the Fritsch-Carlson
 * interpolation generateScale actually applies (see color-engine/scale.ts).
 * The real smoothing happens in the engine; this is the control surface.
 */

const HANDLE_XS: readonly number[] = [0, 0.25, 0.5, 0.75, 1];
const VIEW_WIDTH = 260;
const VIEW_HEIGHT = 72;
const HANDLE_RADIUS = 6;

interface CurveManipulatorProps {
  readonly label: string;
  /** Stored value range for this curve — [0,1] for lightness/chroma,
   *  [-1,1] for hue-torsion. Handles are dragged in a 0-1 slider space and
   *  affine-mapped into this range only when reporting a change. */
  readonly minValue: number;
  readonly maxValue: number;
  /** null means "not customized yet" — falls back to the engine's own
   *  anchor-derived default, shown here as a flat, dimmed placeholder line
   *  rather than an attempt to preview that default shape exactly. */
  readonly points: readonly ControlPoint[] | null;
  readonly onChange: (points: readonly ControlPoint[]) => void;
  readonly onReset: () => void;
  readonly accentHex: string;
}

function valueToSlider(value: number, minValue: number, maxValue: number): number {
  if (maxValue === minValue) return 0.5;
  return (value - minValue) / (maxValue - minValue);
}

function sliderToValue(slider: number, minValue: number, maxValue: number): number {
  return minValue + slider * (maxValue - minValue);
}

function sliderPoints(
  points: readonly ControlPoint[] | null,
  minValue: number,
  maxValue: number
): ControlPoint[] {
  if (points !== null && points.length === HANDLE_XS.length) {
    return points.map((p) => ({ x: p.x, y: valueToSlider(p.y, minValue, maxValue) }));
  }
  return HANDLE_XS.map((x) => ({ x, y: 0.5 }));
}

export function CurveManipulator({
  label,
  minValue,
  maxValue,
  points,
  onChange,
  onReset,
  accentHex,
}: CurveManipulatorProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const isCustom = points !== null;
  const displayPoints = sliderPoints(points, minValue, maxValue);

  function sliderYFromClientY(clientY: number): number {
    const rect = svgRef.current!.getBoundingClientRect();
    const fraction = (clientY - rect.top) / rect.height;
    // Inverted: the top of the box is the highest value.
    return 1 - Math.min(1, Math.max(0, fraction));
  }

  function commit(nextSliderPoints: readonly ControlPoint[]) {
    onChange(
      nextSliderPoints.map((p) => ({ x: p.x, y: sliderToValue(p.y, minValue, maxValue) }))
    );
  }

  function handlePointerDown(index: number) {
    return (event: PointerEvent<SVGCircleElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragIndex(index);
    };
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (dragIndex === null) return;
    const nextSliderY = sliderYFromClientY(event.clientY);
    const next = displayPoints.map((p, i) => (i === dragIndex ? { ...p, y: nextSliderY } : p));
    commit(next);
  }

  function handlePointerUp() {
    setDragIndex(null);
  }

  return (
    <div className={styles.curveManipulator}>
      <div className={styles.curveHead}>
        <span className={styles.curveLabel}>{label}</span>
        {isCustom && (
          <button type="button" className={styles.curveReset} onClick={onReset}>
            reset
          </button>
        )}
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        className={styles.curveSvg}
        data-active={isCustom}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        role="group"
        aria-label={`${label} curve editor`}
      >
        <polyline
          points={displayPoints
            .map((p) => `${p.x * VIEW_WIDTH},${(1 - p.y) * VIEW_HEIGHT}`)
            .join(' ')}
          className={styles.curvePath}
          stroke={accentHex}
        />
        {displayPoints.map((point, i) => (
          <circle
            key={HANDLE_XS[i]}
            cx={point.x * VIEW_WIDTH}
            cy={(1 - point.y) * VIEW_HEIGHT}
            r={HANDLE_RADIUS}
            className={styles.curveHandle}
            fill={accentHex}
            onPointerDown={handlePointerDown(i)}
            tabIndex={0}
            role="slider"
            aria-label={`${label} handle at ${Math.round(HANDLE_XS[i]! * 100)}% progress`}
            aria-valuemin={minValue}
            aria-valuemax={maxValue}
            aria-valuenow={sliderToValue(point.y, minValue, maxValue)}
            onKeyDown={(event) => {
              const KEYBOARD_STEP = 0.02;
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                commit(
                  displayPoints.map((p, idx) =>
                    idx === i ? { ...p, y: Math.min(1, p.y + KEYBOARD_STEP) } : p
                  )
                );
              } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                commit(
                  displayPoints.map((p, idx) =>
                    idx === i ? { ...p, y: Math.max(0, p.y - KEYBOARD_STEP) } : p
                  )
                );
              }
            }}
          />
        ))}
      </svg>
      {!isCustom && <p className={styles.curveHint}>drag a handle to customize this curve</p>}
    </div>
  );
}
