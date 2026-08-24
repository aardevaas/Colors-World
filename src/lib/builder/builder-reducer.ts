import {
  DEFAULT_LIGHTNESS,
  parseColor,
  type ControlPoint,
  type CvdType,
  type Gamut,
  type Oklch,
  type ScaleSpec,
} from '@/lib/color-engine';
// Type-only, and therefore erased at build time: the Builder depends on the
// document model's shape, not the other way round, and nothing at runtime
// crosses back.
import type { ScaleSettings } from '@/lib/system/types';

/**
 * Pure state transitions for /builder — the Palette Builder & Scale Lab.
 * Kept separate from React wiring (same discipline as system-reducer.ts and
 * library-feed-reducer.ts) so the state machine is unit-testable without a
 * component, a browser, or the dock's own localStorage.
 *
 * Every scale here holds exactly one anchor (see PaletteBuilderScale) — the
 * locked architecture decision from the Tab 02 plan: N collected colors
 * become N independent scales, not one scale with N anchors. That single-
 * anchor shape is precisely what makes generateScale's "anchors must get
 * darker as step increases" constraint unreachable in this reducer's output
 * — there is never more than one anchor for it to compare against itself.
 */

export type CvdMode = CvdType | 'none';
export type ExportFormat = 'css' | 'tailwind' | 'shadcn' | 'figma' | 'document';

export const MIN_STEPS = 2;
export const MAX_STEPS = 10;
export const DEFAULT_STEP_COUNT = 10;

export interface BuilderScaleEntry {
  readonly hex: string;
  readonly anchorOklch: Oklch;
  readonly name: string;
  /** False until the user explicitly renames this scale — auto-naming
   *  ('primary', 'accent-1', …) only touches entries where this is false,
   *  so a manual rename survives a later primary-anchor change. */
  readonly nameIsCustom: boolean;
  readonly anchorStep: number;
  readonly chromaIntensity: number;
  readonly hueTorsion: number;
  readonly lightnessCurve: readonly ControlPoint[] | null;
  readonly chromaCurve: readonly ControlPoint[] | null;
  readonly hueTorsionCurve: readonly ControlPoint[] | null;
}

export interface BuilderState {
  readonly stepCount: number;
  readonly gamut: Gamut;
  readonly cvd: CvdMode;
  readonly scales: readonly BuilderScaleEntry[];
  readonly primaryHex: string | null;
  readonly matrixOpen: boolean;
  readonly exportFormat: ExportFormat;
}

export const EMPTY_BUILDER_STATE: BuilderState = {
  stepCount: DEFAULT_STEP_COUNT,
  gamut: 'srgb',
  cvd: 'none',
  scales: [],
  primaryHex: null,
  matrixOpen: false,
  exportFormat: 'css',
};

export interface DockSourceItem {
  readonly hex: string;
  readonly oklch: Oklch;
}

export type BuilderAction =
  | {
      readonly type: 'syncFromDock';
      readonly items: readonly DockSourceItem[];
      readonly primaryAnchorHex: string | null;
      /** Curve work carried by the System, keyed by hex. Absent fields mean
       *  "the default", so following a link that has no curve on a scale
       *  clears one that was drawn locally. */
      readonly settings?: Readonly<Record<string, ScaleSettings>>;
    }
  | { readonly type: 'hydrateSpecs'; readonly specs: readonly ScaleSpec[] }
  | { readonly type: 'setStepCount'; readonly count: number }
  | { readonly type: 'renameScale'; readonly hex: string; readonly name: string }
  | { readonly type: 'setChromaIntensity'; readonly hex: string; readonly value: number }
  | { readonly type: 'setHueTorsion'; readonly hex: string; readonly value: number }
  | {
      readonly type: 'setCurve';
      readonly hex: string;
      readonly axis: 'lightness' | 'chroma' | 'hueTorsion';
      readonly points: readonly ControlPoint[] | null;
    }
  | { readonly type: 'setGamut'; readonly gamut: Gamut }
  | { readonly type: 'setCvd'; readonly cvd: CvdMode }
  | { readonly type: 'toggleMatrix' }
  | { readonly type: 'setExportFormat'; readonly format: ExportFormat };

/**
 * Folds the System's stored decisions onto a scale entry.
 *
 * Within a supplied settings map, an absent field means the default rather
 * than "leave whatever is there": following a link whose author never touched
 * a curve has to clear a curve drawn locally, or the link shows something its
 * author never made. The distinction between an absent *field* and an absent
 * *map* is the whole contract -- see the call site.
 */
function applyScaleSettings(
  entry: BuilderScaleEntry,
  settings: ScaleSettings | undefined
): BuilderScaleEntry {
  const name = settings?.name;
  return {
    ...entry,
    name: name ?? entry.name,
    nameIsCustom: name !== undefined && name !== '',
    chromaIntensity: settings?.chromaIntensity ?? 1,
    hueTorsion: settings?.hueTorsion ?? 0,
    lightnessCurve: settings?.lightnessCurve ?? null,
    chromaCurve: settings?.chromaCurve ?? null,
    hueTorsionCurve: settings?.hueTorsionCurve ?? null,
  };
}

function scalesAreEqual(
  a: readonly BuilderScaleEntry[],
  b: readonly BuilderScaleEntry[]
): boolean {
  if (a.length !== b.length) return false;
  return a.every((entry, i) => {
    const other = b[i]!;
    return (
      entry.hex === other.hex &&
      entry.name === other.name &&
      entry.nameIsCustom === other.nameIsCustom &&
      entry.anchorStep === other.anchorStep &&
      entry.chromaIntensity === other.chromaIntensity &&
      entry.hueTorsion === other.hueTorsion &&
      curvesAreEqual(entry.lightnessCurve, other.lightnessCurve) &&
      curvesAreEqual(entry.chromaCurve, other.chromaCurve) &&
      curvesAreEqual(entry.hueTorsionCurve, other.hueTorsionCurve)
    );
  });
}

function curvesAreEqual(
  a: readonly ControlPoint[] | null,
  b: readonly ControlPoint[] | null
): boolean {
  if (a === null || b === null) return a === b;
  if (a.length !== b.length) return false;
  return a.every((point, i) => point.x === b[i]!.x && point.y === b[i]!.y);
}

function clampStepCount(count: number): number {
  return Math.min(MAX_STEPS, Math.max(MIN_STEPS, Math.round(count)));
}

/**
 * Picks the step whose position on the *default* lightness ramp is closest
 * to the color's own lightness — a reasonable starting anchor step for a
 * freshly collected color, without requiring the user to place it by hand.
 * Deliberately approximate (a linear walk of the default range, not the real
 * monotone-cubic ramp generateScale builds) — this only needs to pick a
 * good starting point, not reproduce the generator exactly.
 */
export function defaultAnchorStepFor(oklch: Oklch, stepCount: number): number {
  const [top, bottom] = DEFAULT_LIGHTNESS;
  const lastIndex = stepCount - 1;
  let bestStep = 0;
  let bestDistance = Infinity;

  for (let step = 0; step <= lastIndex; step += 1) {
    const progress = lastIndex === 0 ? 0 : step / lastIndex;
    const lightnessAtStep = top + (bottom - top) * progress;
    const distance = Math.abs(lightnessAtStep - oklch.l);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestStep = step;
    }
  }

  return bestStep;
}

/**
 * Re-derives auto-generated names in dock order: the primary entry becomes
 * "primary", every other non-custom-named entry becomes "accent-1",
 * "accent-2", … in the order it appears. A scale the user has explicitly
 * renamed (nameIsCustom) is left untouched — renaming which color is
 * primary should never silently overwrite someone's own label.
 */
function withDerivedNames(
  scales: readonly BuilderScaleEntry[],
  primaryHex: string | null
): readonly BuilderScaleEntry[] {
  let accentCount = 0;
  return scales.map((scale) => {
    if (scale.nameIsCustom) return scale;
    const autoName = scale.hex === primaryHex ? 'primary' : `accent-${(accentCount += 1)}`;
    return { ...scale, name: autoName };
  });
}

function createScaleEntry(item: DockSourceItem, stepCount: number): BuilderScaleEntry {
  return {
    hex: item.hex,
    anchorOklch: item.oklch,
    name: item.hex,
    nameIsCustom: false,
    anchorStep: defaultAnchorStepFor(item.oklch, stepCount),
    chromaIntensity: 1,
    hueTorsion: 0,
    lightnessCurve: null,
    chromaCurve: null,
    hueTorsionCurve: null,
  };
}

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case 'syncFromDock': {
      const existingByHex = new Map(state.scales.map((scale) => [scale.hex, scale]));
      const nextScales = action.items.map((item) => {
        const base = existingByHex.get(item.hex) ?? createScaleEntry(item, state.stepCount);
        // No settings map at all means the caller is not speaking about
        // curve work -- a plain re-sync after a palette reorder, say -- and
        // local edits must survive it. Only a supplied map is authoritative.
        return action.settings === undefined
          ? base
          : applyScaleSettings(base, action.settings[item.hex.toLowerCase()]);
      });
      const named = withDerivedNames(nextScales, action.primaryAnchorHex);

      // Returning the identical object when nothing changed is what keeps the
      // two-way sync with the System from oscillating: the System writes back
      // whatever the Builder holds, which arrives here again a moment later,
      // and a fresh object every time would re-render and re-write forever.
      if (state.primaryHex === action.primaryAnchorHex && scalesAreEqual(state.scales, named)) {
        return state;
      }
      return { ...state, scales: named, primaryHex: action.primaryAnchorHex };
    }

    case 'hydrateSpecs': {
      // Reopening a saved palette. Deliberately self-contained — it does not
      // wait for a prior syncFromDock to have created matching entries; it
      // builds the scales directly from the specs (anchor color is always
      // spec.anchors[0].color, since /builder only ever saves single-anchor
      // scales — see specFor in BuilderShell.tsx). The dock is populated
      // separately by the caller for consistency, but this doesn't depend
      // on that having happened first or on any particular ordering: a
      // later syncFromDock will find these hexes already present (via its
      // own existingByHex lookup) and preserve everything set here.
      const nextStepCount = clampStepCount(action.specs[0]?.steps ?? state.stepCount);
      const scales = action.specs
        .map((spec): BuilderScaleEntry | null => {
          const anchor = spec.anchors[0];
          if (anchor === undefined) return null;
          return {
            hex: anchor.color,
            anchorOklch: parseColor(anchor.color),
            name: spec.name,
            nameIsCustom: true,
            anchorStep: Math.min(anchor.step, nextStepCount - 1),
            chromaIntensity: spec.chromaIntensity ?? 1,
            hueTorsion: spec.hueTorsion ?? 0,
            lightnessCurve: spec.lightnessCurve ?? null,
            chromaCurve: spec.chromaCurve ?? null,
            hueTorsionCurve: spec.hueTorsionCurve ?? null,
          };
        })
        .filter((entry): entry is BuilderScaleEntry => entry !== null);

      return {
        ...state,
        stepCount: nextStepCount,
        scales,
        primaryHex: scales[0]?.hex ?? null,
      };
    }

    case 'setStepCount': {
      const nextCount = clampStepCount(action.count);
      return {
        ...state,
        stepCount: nextCount,
        // The exact regression this reducer exists to prevent: generateScale
        // throws if an anchor's step is >= the new step count. Every scale's
        // anchor must be pulled back onto the shrunk range immediately.
        scales: state.scales.map((scale) => ({
          ...scale,
          anchorStep: Math.min(scale.anchorStep, nextCount - 1),
        })),
      };
    }

    case 'renameScale':
      return {
        ...state,
        scales: state.scales.map((scale) =>
          scale.hex === action.hex ? { ...scale, name: action.name, nameIsCustom: true } : scale
        ),
      };

    case 'setChromaIntensity':
      return {
        ...state,
        scales: state.scales.map((scale) =>
          scale.hex === action.hex ? { ...scale, chromaIntensity: action.value } : scale
        ),
      };

    case 'setHueTorsion':
      return {
        ...state,
        scales: state.scales.map((scale) =>
          scale.hex === action.hex ? { ...scale, hueTorsion: action.value } : scale
        ),
      };

    case 'setCurve':
      return {
        ...state,
        scales: state.scales.map((scale) => {
          if (scale.hex !== action.hex) return scale;
          const key = `${action.axis}Curve` as const;
          return { ...scale, [key]: action.points };
        }),
      };

    case 'setGamut':
      return { ...state, gamut: action.gamut };

    case 'setCvd':
      return { ...state, cvd: action.cvd };

    case 'toggleMatrix':
      return { ...state, matrixOpen: !state.matrixOpen };

    case 'setExportFormat':
      return { ...state, exportFormat: action.format };

    default:
      return state;
  }
}
