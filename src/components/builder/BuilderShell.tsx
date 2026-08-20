'use client';

import { useEffect, useMemo, useReducer, useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  CVD_TYPES,
  generateScale,
  parseColor,
  type ControlPoint,
  type CvdType,
  type Gamut,
  type GeneratedScale,
  type ScaleSpec,
} from '@/lib/color-engine';
import { snapshotFromScales } from '@/lib/versioning';
import type { ScaleSettings } from '@/lib/system/types';
import { createPaletteFromScale } from '@/app/palettes/actions';
import { useSystem } from '@/lib/system/system-context';
import { TabNav } from '@/components/nav/TabNav';
import {
  builderReducer,
  EMPTY_BUILDER_STATE,
  type BuilderScaleEntry,
  type CvdMode,
} from '@/lib/builder/builder-reducer';
import { StepControls } from './StepControls';
import { ScalePanel } from './ScalePanel';
import { ContrastMatrixPanel } from './ContrastMatrixPanel';
import { GamutTriptych } from './GamutTriptych';
import { ExportVault } from './ExportVault';
import styles from './builder.module.css';

const GAMUT_OPTIONS: readonly Gamut[] = ['srgb', 'p3', 'rec2020'];
const CVD_OPTIONS: readonly { readonly value: CvdMode; readonly label: string }[] = [
  { value: 'none', label: 'Normal vision' },
  ...CVD_TYPES.map((type) => ({ value: type, label: labelForCvd(type) })),
];

function labelForCvd(type: CvdType): string {
  switch (type) {
    case 'protanopia':
      return 'Protanopia';
    case 'deuteranopia':
      return 'Deuteranopia';
    case 'tritanopia':
      return 'Tritanopia';
    case 'achromatopsia':
      return 'Achromatopsia';
    default:
      return type;
  }
}

function specFor(entry: BuilderScaleEntry, stepCount: number, gamut: Gamut): ScaleSpec {
  return {
    name: entry.name,
    steps: stepCount,
    anchors: [{ step: entry.anchorStep, color: entry.hex }],
    gamut,
    chromaIntensity: entry.chromaIntensity,
    hueTorsion: entry.hueTorsion,
    ...(entry.lightnessCurve !== null ? { lightnessCurve: entry.lightnessCurve } : {}),
    ...(entry.chromaCurve !== null ? { chromaCurve: entry.chromaCurve } : {}),
    ...(entry.hueTorsionCurve !== null ? { hueTorsionCurve: entry.hueTorsionCurve } : {}),
  };
}

interface BuilderShellProps {
  readonly accountSlot?: ReactNode;
  /** From ?palette=<id> — reopens a previously saved palette editable. */
  readonly initialSpecs?: readonly ScaleSpec[] | null;
}

export function BuilderShell({ accountSlot, initialSpecs = null }: BuilderShellProps) {
  const router = useRouter();
  const { system, addColor, setScale, setScaleGlobals } = useSystem();
  const [state, dispatch] = useReducer(builderReducer, EMPTY_BUILDER_STATE);
  const [paletteName, setPaletteName] = useState('brand');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const hydratedRef = useRef(false);

  // Reopening a saved palette: seed the scales directly from its specs (see
  // builderReducer's hydrateSpecs — self-contained, doesn't wait on a
  // System sync), and best-effort add each anchor to the System too so it's
  // consistent with what /builder is now showing. Runs once per mount only
  // — this is a one-time "load," not something that should re-fire and
  // clobber edits if initialSpecs' identity happens to change.
  useEffect(() => {
    if (hydratedRef.current || initialSpecs === null || initialSpecs.length === 0) return;
    hydratedRef.current = true;
    dispatch({ type: 'hydrateSpecs', specs: initialSpecs });
    for (const spec of initialSpecs) {
      const anchor = spec.anchors[0];
      if (anchor === undefined) continue;
      try {
        addColor(anchor.color, parseColor(anchor.color));
      } catch {
        // A malformed persisted anchor colour shouldn't block the rest of
        // the hydrate — that scale just won't also appear in the System.
      }
    }
    // Deliberately runs once (guarded by hydratedRef) regardless of System
    // identity changes afterward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSpecs]);

  // The System is the single source of truth for *which* colours are in
  // play — /builder never adds or removes a scale on its own, it only
  // customizes the ones the System already has. Per-scale
  // curves/intensity/name persist in the reducer (see builderReducer's
  // syncFromDock) across every re-sync.
  useEffect(() => {
    dispatch({
      type: 'syncFromDock',
      items: system.palette.map((color) => ({ hex: color.hex, oklch: color.oklch })),
      primaryAnchorHex: system.anchorHex,
      // Authoritative: following a link has to reproduce its author's curves
      // exactly, including the ones they never drew.
      settings: system.scales.byHex,
    });
    // system.palette is a new array identity on every provider render; the
    // sync itself is cheap and idempotent (createScaleEntry only runs for
    // genuinely new hexes), so re-running on every System change is correct
    // and intentional rather than a dependency to prune.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [system.palette, system.anchorHex, system.scales.byHex]);

  // Curve work back out to the System, so a shared link carries it. Guarded by
  // comparison rather than by dependency-array cleverness: the reducer returns
  // the identical state when a sync changes nothing, so an echo terminates
  // here instead of looping.
  useEffect(() => {
    for (const scale of state.scales) {
      const next = settingsFromScale(scale);
      const current = system.scales.byHex[scale.hex.toLowerCase()];
      if (!sameSettings(next, current)) setScale(scale.hex, next);
    }
    if (state.stepCount !== system.scales.steps || state.gamut !== system.scales.gamut) {
      setScaleGlobals({ steps: state.stepCount, gamut: state.gamut });
    }
    // `setScale`/`setScaleGlobals` are stable dispatch wrappers; including
    // them would re-run this on every provider render for no benefit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.scales, state.stepCount, state.gamut, system.scales]);

  const primaryEntry = useMemo(
    () => state.scales.find((entry) => entry.hex === state.primaryHex) ?? state.scales[0],
    [state.scales, state.primaryHex]
  );

  const generatedScales = useMemo<readonly GeneratedScale[]>(
    () => state.scales.map((entry) => generateScale(specFor(entry, state.stepCount, state.gamut))),
    [state.scales, state.stepCount, state.gamut]
  );

  const primaryIndex = Math.max(
    0,
    state.scales.findIndex((entry) => entry.hex === state.primaryHex)
  );

  function handleSaveAsPalette() {
    if (generatedScales.length === 0) return;
    setSaveError(null);
    startSave(async () => {
      try {
        // The spec travels with the palette, not just the resolved hex
        // values, so reopening it later restores every curve/torsion/
        // intensity customization rather than a flat, uncustomized ramp.
        const specs = generatedScales.map((scale) => scale.spec);
        const snapshot = snapshotFromScales(generatedScales);
        const { paletteId } = await createPaletteFromScale(paletteName, snapshot, specs);
        router.push(`/palettes/${paletteId}`);
      } catch (cause) {
        setSaveError(cause instanceof Error ? cause.message : String(cause));
      }
    });
  }

  function updateCurve(hex: string, axis: 'lightness' | 'chroma' | 'hueTorsion') {
    return (points: readonly ControlPoint[]) => dispatch({ type: 'setCurve', hex, axis, points });
  }

  function resetCurve(hex: string, axis: 'lightness' | 'chroma' | 'hueTorsion') {
    return () => dispatch({ type: 'setCurve', hex, axis, points: null });
  }

  return (
    <div className={styles.shell}>
      <TabNav current="scales">{accountSlot}</TabNav>

      <div className={styles.globalControls}>
        <StepControls
          stepCount={state.stepCount}
          onChange={(count) => dispatch({ type: 'setStepCount', count })}
        />

        <label className={styles.selectField}>
          <span>Gamut</span>
          <select
            className={styles.selectInput}
            value={state.gamut}
            onChange={(event) => dispatch({ type: 'setGamut', gamut: event.target.value as Gamut })}
          >
            {GAMUT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.selectField}>
          <span>Vision simulation</span>
          <select
            className={styles.selectInput}
            value={state.cvd}
            onChange={(event) => dispatch({ type: 'setCvd', cvd: event.target.value as CvdMode })}
          >
            {CVD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {state.scales.length > 0 && (
          <label className={styles.selectField}>
            <span>Save as</span>
            <input
              type="text"
              className={styles.selectInput}
              value={paletteName}
              onChange={(event) => setPaletteName(event.target.value)}
              aria-label="Palette name"
            />
            <button
              type="button"
              className={styles.stepPill}
              onClick={handleSaveAsPalette}
              disabled={isSaving}
            >
              {isSaving ? 'saving…' : 'save palette'}
            </button>
          </label>
        )}
      </div>

      {saveError !== null && <p className={styles.saveError}>⚠ {saveError}</p>}

      {state.scales.length === 0 ? (
        <p className={styles.emptyState}>
          Every colour in your System becomes a scale here, and the first one is the
          anchor. Make a palette in Compose, or collect colours in Library.
        </p>
      ) : (
        <div className={styles.scaleList}>
          {state.scales.map((entry, i) => (
            <ScalePanel
              key={entry.hex}
              entry={entry}
              scale={generatedScales[i]!}
              isPrimary={entry.hex === state.primaryHex}
              gamut={state.gamut}
              cvd={state.cvd}
              onRename={(name) => dispatch({ type: 'renameScale', hex: entry.hex, name })}
              onSetPrimary={() => dispatch({ type: 'setPrimary', hex: entry.hex })}
              onSetChromaIntensity={(value) =>
                dispatch({ type: 'setChromaIntensity', hex: entry.hex, value })
              }
              onSetHueTorsion={(value) => dispatch({ type: 'setHueTorsion', hex: entry.hex, value })}
              onSetCurve={(axis, points) => updateCurve(entry.hex, axis)(points)}
              onResetCurve={(axis) => resetCurve(entry.hex, axis)()}
            />
          ))}
        </div>
      )}

      {primaryEntry !== undefined && (
        <section className={styles.gamutSection}>
          <h2 className={styles.gamutTitle}>
            <span className={styles.primaryName}>{primaryEntry.name}</span> across displays
          </h2>
          {/* The primary scale only. Three ramps per scale would be six or more
              stacked ramps on a page that is already long, and the question
              "does my ramp survive a narrow display" is answered by the scale
              carrying the most weight. */}
          <GamutTriptych spec={specFor(primaryEntry, state.stepCount, state.gamut)} />
        </section>
      )}

      {state.scales.length > 0 && (
        <>
          <ContrastMatrixPanel
            scales={generatedScales}
            open={state.matrixOpen}
            onToggle={() => dispatch({ type: 'toggleMatrix' })}
          />
          <ExportVault
            scales={generatedScales}
            primaryIndex={primaryIndex}
            format={state.exportFormat}
            onFormatChange={(format) => dispatch({ type: 'setExportFormat', format })}
          />
        </>
      )}
    </div>
  );
}

/**
 * The decisions a scale carries, stripped of everything derivable. Defaults
 * are omitted rather than written out, so a scale nobody has touched adds
 * nothing to the URL.
 */
function settingsFromScale(scale: BuilderScaleEntry): ScaleSettings {
  const settings: {
    name?: string;
    chromaIntensity?: number;
    hueTorsion?: number;
    lightnessCurve?: readonly ControlPoint[];
    chromaCurve?: readonly ControlPoint[];
    hueTorsionCurve?: readonly ControlPoint[];
  } = {};
  if (scale.nameIsCustom && scale.name !== '') settings.name = scale.name;
  if (scale.chromaIntensity !== 1) settings.chromaIntensity = scale.chromaIntensity;
  if (scale.hueTorsion !== 0) settings.hueTorsion = scale.hueTorsion;
  if (scale.lightnessCurve !== null) settings.lightnessCurve = scale.lightnessCurve;
  if (scale.chromaCurve !== null) settings.chromaCurve = scale.chromaCurve;
  if (scale.hueTorsionCurve !== null) settings.hueTorsionCurve = scale.hueTorsionCurve;
  return settings;
}

function sameSettings(a: ScaleSettings, b: ScaleSettings | undefined): boolean {
  const left = JSON.stringify(a);
  const right = JSON.stringify(b ?? {});
  return left === right;
}
