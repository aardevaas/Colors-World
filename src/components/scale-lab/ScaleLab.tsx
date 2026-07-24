'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState, useTransition } from 'react';
import { generateScale, type Gamut, type GeneratedScale } from '@/lib/color-engine';
import {
  toCssCustomProperties,
  toFigmaTokens,
  toTailwindTheme,
} from '@/lib/exporters/tokens';
import { snapshotFromScales } from '@/lib/versioning';
import { createPaletteFromScale } from '@/app/palettes/actions';
import { ScaleColumn, type CvdMode } from './ScaleColumn';
import styles from './scale-lab.module.css';

const CVD_OPTIONS: readonly { value: CvdMode; label: string }[] = [
  { value: 'none', label: 'Normal vision' },
  { value: 'protanopia', label: 'Protanopia' },
  { value: 'deuteranopia', label: 'Deuteranopia' },
  { value: 'tritanopia', label: 'Tritanopia' },
  { value: 'achromatopsia', label: 'Achromatopsia' },
];

const GAMUT_OPTIONS: readonly Gamut[] = ['srgb', 'p3', 'rec2020'];
const EXPORT_FORMATS = ['css', 'tailwind', 'figma'] as const;
type ExportFormat = (typeof EXPORT_FORMATS)[number];

const STEP_COUNT = 10;

interface ScaleLabProps {
  /** A Server Component (AccountStatus) passed down as a slot — a Client
   * Component can't import a Server Component directly. */
  readonly accountSlot?: React.ReactNode;
}

export function ScaleLab({ accountSlot }: ScaleLabProps) {
  const router = useRouter();
  const [name, setName] = useState('brand');
  const [anchorColor, setAnchorColor] = useState('#3b82f6');
  const [anchorStep, setAnchorStep] = useState(5);
  const [chromaIntensity, setChromaIntensity] = useState(1);
  const [hueTorsion, setHueTorsion] = useState(0);
  const [gamut, setGamut] = useState<Gamut>('srgb');
  const [cvd, setCvd] = useState<CvdMode>('none');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('css');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();

  // Keeping the last valid scale means a half-typed hex blanks the readout
  // instead of destroying the swatches you were looking at.
  const lastValid = useRef<GeneratedScale | null>(null);

  const { scale, error } = useMemo(() => {
    try {
      const generated = generateScale({
        name,
        steps: STEP_COUNT,
        anchors: [{ step: anchorStep, color: anchorColor }],
        chromaIntensity,
        hueTorsion,
        gamut,
      });
      lastValid.current = generated;
      return { scale: generated, error: null as string | null };
    } catch (cause) {
      return {
        scale: lastValid.current,
        error: cause instanceof Error ? cause.message : String(cause),
      };
    }
  }, [name, anchorColor, anchorStep, chromaIntensity, hueTorsion, gamut]);

  const exported = useMemo(() => {
    if (scale === null) return '';
    if (exportFormat === 'css') return toCssCustomProperties([scale]);
    if (exportFormat === 'tailwind') return toTailwindTheme([scale]);
    return toFigmaTokens([scale]);
  }, [scale, exportFormat]);

  const clampedCount = scale?.steps.filter((s) => s.gamutClamped).length ?? 0;

  function handleSaveAsPalette() {
    if (scale === null) return;
    setSaveError(null);
    startSave(async () => {
      try {
        const snapshot = snapshotFromScales([scale]);
        const { paletteId } = await createPaletteFromScale(name, snapshot);
        router.push(`/palettes/${paletteId}`);
      } catch (cause) {
        setSaveError(cause instanceof Error ? cause.message : String(cause));
      }
    });
  }

  return (
    <div className={styles.shell}>
      <header className={styles.masthead}>
        <h1 className={styles.wordmark}>
          Colors World <span className={styles.wordmarkDim}>/ scale lab</span>
        </h1>
        <nav className={styles.navGroup}>
          <Link href="/studio" className={styles.navLink}>
            ← studio
          </Link>
          <Link href="/spectrum" className={styles.navLink}>
            spectrum
          </Link>
          <Link href="/library" className={styles.navLink}>
            library
          </Link>
          <Link href="/palettes" className={styles.navLink}>
            palettes
          </Link>
          <Link href="/assets" className={styles.navLink}>
            assets
          </Link>
          <Link href="/merge" className={styles.navLink}>
            merge lab →
          </Link>
        </nav>
        <p className={styles.specLine}>
          {STEP_COUNT} steps · oklch · anchor @ {anchorStep} · {gamut}
          {clampedCount > 0 ? ` · ${clampedCount} clamped` : ''}
        </p>
        {accountSlot}
      </header>

      <main className={styles.scale} aria-label="Generated tonal scale">
        {scale?.steps.map((step) => (
          <ScaleColumn
            key={step.step}
            step={step}
            cvd={cvd}
            pinned={step.step === anchorStep}
          />
        ))}
      </main>

      <section className={styles.panel} aria-label="Scale controls">
        <div className={styles.field}>
          <label className={styles.label} htmlFor="scale-name">
            Name
          </label>
          <input
            id="scale-name"
            className={styles.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Persist</span>
          <button
            type="button"
            className={styles.tab}
            onClick={handleSaveAsPalette}
            disabled={isSaving || scale === null}
          >
            {isSaving ? 'saving…' : 'save as palette'}
          </button>
          {saveError !== null && <p className={styles.error}>⚠ {saveError}</p>}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="anchor-color">
            Anchor colour
          </label>
          <input
            id="anchor-color"
            className={styles.input}
            value={anchorColor}
            spellCheck={false}
            onChange={(event) => setAnchorColor(event.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="anchor-step">
            Anchor step <span className={styles.value}>{anchorStep}</span>
          </label>
          <input
            id="anchor-step"
            className={styles.slider}
            type="range"
            min={0}
            max={STEP_COUNT - 1}
            step={1}
            value={anchorStep}
            onChange={(event) => setAnchorStep(Number(event.target.value))}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="chroma">
            Chroma <span className={styles.value}>{chromaIntensity.toFixed(2)}</span>
          </label>
          <input
            id="chroma"
            className={styles.slider}
            type="range"
            min={0}
            max={1.6}
            step={0.02}
            value={chromaIntensity}
            onChange={(event) => setChromaIntensity(Number(event.target.value))}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="torsion">
            Hue torsion <span className={styles.value}>{hueTorsion}°</span>
          </label>
          <input
            id="torsion"
            className={styles.slider}
            type="range"
            min={-60}
            max={60}
            step={1}
            value={hueTorsion}
            onChange={(event) => setHueTorsion(Number(event.target.value))}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="gamut">
            Gamut
          </label>
          <select
            id="gamut"
            className={styles.select}
            value={gamut}
            onChange={(event) => setGamut(event.target.value as Gamut)}
          >
            {GAMUT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="cvd">
            Vision simulation
          </label>
          <select
            id="cvd"
            className={styles.select}
            value={cvd}
            onChange={(event) => setCvd(event.target.value as CvdMode)}
          >
            {CVD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Export</span>
          <div className={styles.exportBar}>
            {EXPORT_FORMATS.map((format) => (
              <button
                key={format}
                type="button"
                className={styles.tab}
                aria-pressed={exportFormat === format}
                onClick={() => setExportFormat(format)}
              >
                {format}
              </button>
            ))}
          </div>
        </div>

        {error !== null && <p className={styles.error}>⚠ {error}</p>}

        <pre className={styles.code}>{exported}</pre>
      </section>
    </div>
  );
}
