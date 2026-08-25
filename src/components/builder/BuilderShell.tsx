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
import { RoomMain, SkipLink } from '@/components/nav/SkipLink';
import { SystemLink } from '@/components/system/SystemLink';

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
  const { system, addColor, setAnchor, setScale, setScaleGlobals } = useSystem();
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
        // A malformed persisted anchor color shouldn't block the rest of
        // the hydrate — that scale just won't also appear in the System.
      }
    }
    // Deliberately runs once (guarded by hydratedRef) regardless of System
    // identity changes afterward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSpecs]);

  // The System is the single source of truth for *which* colors are in
  // play — /builder never adds or removes a scale on its own, it only
  // customizes the ones the System already has. Per-scale
  // curves/intensity/name persist in the reducer (see builderReducer's
  // syncFromDock) across every re-sync.
  /*
   * KEYED ON CONTENT, NOT IDENTITY — and that is the whole point of these two
   * lines.
   *
   * This used to depend on `system.palette` and `system.scales.byHex`
   * directly, with a comment saying a new array identity on every provider
   * render was fine because the sync is idempotent. It is idempotent, and it
   * was still the hazard React names by default when this kind of loop
   * happens: "one of the dependencies changes on every render."
   *
   * The sync is one half of a two-way street — the System writes back
   * whatever the Builder holds (see the effect below), and that write returns
   * here a moment later. Two hand-written equality guards stood between that
   * and an infinite loop: `scalesAreEqual` in the reducer, and `sameSettings`
   * further down. Both look right; one of them let a loop through on a real
   * machine that I could not reproduce on mine.
   *
   * Depending on the CONTENT removes the question. A palette of the same
   * hexes in the same order produces the same key no matter how many times
   * the provider re-renders, so the effect simply does not fire.
   *
   * ## And it must NOT depend on the settings it writes
   *
   * This is the loop, and dragging a slider was how it showed up. The chain
   * ran: slider moves → builder state changes → the effect below writes it to
   * the System → the System's settings change → THIS effect fires →
   * `applyScaleSettings` overwrites the builder entry from the System.
   *
   * That last step is the damage. `applyScaleSettings` resets any value the
   * System does not carry to its default (`?? 1`, `?? 0`, `?? null`), so a
   * sync arriving mid-drag does not merely echo — it clobbers the edit that
   * is still in flight. One value at a time survived it; a drag is a stream
   * of them, and each write raced the sync-back until React counted fifty
   * nested updates and stopped. The chroma slider dragged to 1.6 ended up
   * back at 1, which is exactly that default being reasserted.
   *
   * The System is authoritative for curve work at LOAD, not forever. Once the
   * room is open the Builder owns those values, and the System is downstream
   * of it. So this fires on palette membership and anchor — the cases where
   * the System genuinely knows something the Builder does not: following a
   * link, or a colour arriving from another room — and never on the settings
   * it produced itself.
   */
  const paletteKey = system.palette.map((color) => color.hex).join(',');

  useEffect(() => {
    dispatch({
      type: 'syncFromDock',
      items: system.palette.map((color) => ({ hex: color.hex, oklch: color.oklch })),
      primaryAnchorHex: system.anchorHex,
      // Authoritative here precisely because this only fires when the palette
      // itself changed: following a link has to reproduce its author's curves
      // exactly, including the ones they never drew.
      settings: system.scales.byHex,
    });
    // `system` itself is read fresh from the render closure each time this
    // fires; the key decides WHEN it fires, not what it reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paletteKey, system.anchorHex]);

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
    //
    // Deliberately depends on NOTHING it writes. This effect is the one
    // direction that is allowed: Builder state flows out to the System, and
    // never the reverse. `system.scales` appears only inside the body, read
    // fresh from the closure to decide whether a write is needed at all.
    //
    // `system.scales.steps`/`.gamut` were in this array and converged by
    // luck rather than by design — the System reducer happens to store them
    // verbatim, so a write makes the comparison equal on the next pass. The
    // day anything clamps or normalises on the way in, the two sides would
    // never agree and this becomes the same loop the sliders produced.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.scales, state.stepCount, state.gamut]);

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
      <SkipLink />
      <TabNav current="scales">{accountSlot}</TabNav>
      <RoomMain>
        {/*
          Every other room says what it is; this one dropped you straight into a
          toolbar. With an empty System that left a row of controls above six
          hundred pixels of nothing, and no answer anywhere on the page to the
          only question a first visitor has, which is what a scale is FOR.
        */}
        <header className={styles.intro}>
          <h2 className={styles.introTitle}>One color, all the way up and down.</h2>
          <p className={styles.introLede}>
            A scale is a color taken from its lightest usable step to its darkest, with
            every step measured — so you can see which of them your screen can actually
            show, and which are being clamped to fit.
          </p>
        </header>

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
        /*
         * An empty room should still be legible.
         *
         * This was one grey sentence centred in a void — accurate, and no help:
         * it named two other rooms without saying why you would want what this
         * one makes. It now explains the thing and offers the two ways in as
         * controls rather than as prose.
         */
        <div className={styles.emptyState}>
          <p className={styles.emptyLead}>
            Nothing to build from yet. Every color in your System becomes a scale here,
            and the first one is the anchor.
          </p>
          <div className={styles.emptyActions}>
            <SystemLink href="/library" className={styles.emptyPrimary}>
              Pick a color in Library
            </SystemLink>
            <SystemLink href="/compose" className={styles.emptySecondary}>
              Build a palette in Compose
            </SystemLink>
          </div>
        </div>
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
              /*
               * Writes to the SYSTEM, not to local state. The sync effect above
               * carries `system.anchorHex` back down into `primaryHex`, so the
               * star has one source of truth and cannot diverge from it.
               *
               * It used to dispatch the Builder's own `setPrimary`, which moved
               * the marker and re-derived the names but never wrote
               * `system.anchorHex` — so it reset on reload and every other room,
               * all of which read the anchor, never heard about it.
               */
              onSetPrimary={() => setAnchor(entry.hex)}
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
      </RoomMain>
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
