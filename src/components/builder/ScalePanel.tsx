'use client';

import type { ControlPoint, CvdType, Gamut, GeneratedScale } from '@/lib/color-engine';
import type { BuilderScaleEntry } from '@/lib/builder/builder-reducer';
import { CurveManipulator } from './CurveManipulator';
import { SwatchRow } from './SwatchRow';
import { GradientRibbon } from './GradientRibbon';
import styles from './builder.module.css';

type CurveAxis = 'lightness' | 'chroma' | 'hueTorsion';

interface ScalePanelProps {
  readonly entry: BuilderScaleEntry;
  readonly scale: GeneratedScale;
  readonly isPrimary: boolean;
  readonly gamut: Gamut;
  readonly cvd: CvdType | 'none';
  readonly onRename: (name: string) => void;
  readonly onSetPrimary: () => void;
  readonly onSetChromaIntensity: (value: number) => void;
  readonly onSetHueTorsion: (value: number) => void;
  readonly onSetCurve: (axis: CurveAxis, points: readonly ControlPoint[]) => void;
  readonly onResetCurve: (axis: CurveAxis) => void;
}

const CURVE_AXES: readonly { readonly axis: CurveAxis; readonly label: string; readonly min: number; readonly max: number }[] = [
  { axis: 'lightness', label: 'Lightness', min: 0, max: 1 },
  { axis: 'chroma', label: 'Chroma', min: 0, max: 1 },
  { axis: 'hueTorsion', label: 'Hue Torsion', min: -1, max: 1 },
];

function curveFor(entry: BuilderScaleEntry, axis: CurveAxis): readonly ControlPoint[] | null {
  if (axis === 'lightness') return entry.lightnessCurve;
  if (axis === 'chroma') return entry.chromaCurve;
  return entry.hueTorsionCurve;
}

export function ScalePanel({
  entry,
  scale,
  isPrimary,
  gamut,
  cvd,
  onRename,
  onSetPrimary,
  onSetChromaIntensity,
  onSetHueTorsion,
  onSetCurve,
  onResetCurve,
}: ScalePanelProps) {
  return (
    <section className={styles.scalePanel} data-primary={isPrimary}>
      <header className={styles.scalePanelHead}>
        <button
          type="button"
          className={styles.scalePrimaryStar}
          data-active={isPrimary}
          onClick={onSetPrimary}
          aria-pressed={isPrimary}
          aria-label={isPrimary ? `${entry.name} is the Primary Anchor` : `Make ${entry.name} the Primary Anchor`}
          title="Set as Primary Anchor"
        >
          {isPrimary ? '★' : '☆'}
        </button>
        <input
          className={styles.scaleNameInput}
          value={entry.name}
          onChange={(event) => onRename(event.target.value)}
          aria-label="Scale name"
        />
        <span className={styles.scaleAnchorSwatch} style={{ background: entry.hex }} title={entry.hex} />
      </header>

      <SwatchRow scale={scale} gamut={gamut} cvd={cvd} />
      <GradientRibbon scale={scale} />

      <div className={styles.curveGrid}>
        {CURVE_AXES.map(({ axis, label, min, max }) => (
          <CurveManipulator
            key={axis}
            label={label}
            minValue={min}
            maxValue={max}
            points={curveFor(entry, axis)}
            onChange={(points) => onSetCurve(axis, points)}
            onReset={() => onResetCurve(axis)}
            accentHex={entry.hex}
          />
        ))}
      </div>

      <div className={styles.scaleSliders}>
        <label className={styles.scaleSliderField}>
          <span>
            Chroma intensity <output>{entry.chromaIntensity.toFixed(2)}</output>
          </span>
          <input
            type="range"
            min={0}
            max={1.6}
            step={0.02}
            value={entry.chromaIntensity}
            onChange={(event) => onSetChromaIntensity(Number(event.target.value))}
          />
        </label>
        <label className={styles.scaleSliderField}>
          <span>
            Hue torsion <output>{entry.hueTorsion.toFixed(0)}&deg;</output>
          </span>
          <input
            type="range"
            min={-60}
            max={60}
            step={1}
            value={entry.hueTorsion}
            onChange={(event) => onSetHueTorsion(Number(event.target.value))}
          />
        </label>
      </div>
    </section>
  );
}
