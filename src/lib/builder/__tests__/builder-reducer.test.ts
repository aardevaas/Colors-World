import { describe, expect, it } from 'vitest';
import {
  builderReducer,
  defaultAnchorStepFor,
  EMPTY_BUILDER_STATE,
  type BuilderState,
  type DockSourceItem,
} from '../builder-reducer';

const BLUE: DockSourceItem = { hex: '#3b82f6', oklch: { l: 0.62, c: 0.19, h: 259 } };
const GREEN: DockSourceItem = { hex: '#22c55e', oklch: { l: 0.72, c: 0.19, h: 149 } };
const PURPLE: DockSourceItem = { hex: '#8e4ec6', oklch: { l: 0.55, c: 0.2, h: 306 } };

function synced(items: readonly DockSourceItem[], primaryHex: string | null): BuilderState {
  return builderReducer(EMPTY_BUILDER_STATE, {
    type: 'syncFromDock',
    items,
    primaryAnchorHex: primaryHex,
  });
}

describe('defaultAnchorStepFor', () => {
  it('places a light colour near step 0', () => {
    const step = defaultAnchorStepFor({ l: 0.95, c: 0.05, h: 200 }, 10);
    expect(step).toBeLessThan(2);
  });

  it('places a dark colour near the last step', () => {
    const step = defaultAnchorStepFor({ l: 0.25, c: 0.1, h: 200 }, 10);
    expect(step).toBeGreaterThan(7);
  });

  it('stays within [0, stepCount-1] for any input', () => {
    for (const l of [0, 0.1, 0.5, 0.9, 1]) {
      const step = defaultAnchorStepFor({ l, c: 0.1, h: 0 }, 5);
      expect(step).toBeGreaterThanOrEqual(0);
      expect(step).toBeLessThanOrEqual(4);
    }
  });
});

describe('builderReducer — syncFromDock', () => {
  it('creates one scale entry per dock item', () => {
    const state = synced([BLUE, GREEN], BLUE.hex);
    expect(state.scales).toHaveLength(2);
    expect(state.scales.map((s) => s.hex)).toEqual([BLUE.hex, GREEN.hex]);
  });

  it('auto-names the primary entry "primary" and others "accent-N" in order', () => {
    const state = synced([BLUE, GREEN, PURPLE], BLUE.hex);
    expect(state.scales.find((s) => s.hex === BLUE.hex)!.name).toBe('primary');
    expect(state.scales.find((s) => s.hex === GREEN.hex)!.name).toBe('accent-1');
    expect(state.scales.find((s) => s.hex === PURPLE.hex)!.name).toBe('accent-2');
  });

  it('preserves an existing entry (curves, intensity, custom name) when re-syncing', () => {
    const initial = synced([BLUE, GREEN], BLUE.hex);
    const customized = builderReducer(initial, {
      type: 'setChromaIntensity',
      hex: GREEN.hex,
      value: 0.5,
    });
    const renamed = builderReducer(customized, {
      type: 'renameScale',
      hex: GREEN.hex,
      name: 'forest',
    });

    const resynced = builderReducer(renamed, {
      type: 'syncFromDock',
      items: [BLUE, GREEN],
      primaryAnchorHex: BLUE.hex,
    });

    const green = resynced.scales.find((s) => s.hex === GREEN.hex)!;
    expect(green.chromaIntensity).toBe(0.5);
    expect(green.name).toBe('forest');
    expect(green.nameIsCustom).toBe(true);
  });

  it('removes entries for colours no longer in the dock', () => {
    const withThree = synced([BLUE, GREEN, PURPLE], BLUE.hex);
    const withoutPurple = builderReducer(withThree, {
      type: 'syncFromDock',
      items: [BLUE, GREEN],
      primaryAnchorHex: BLUE.hex,
    });
    expect(withoutPurple.scales.map((s) => s.hex)).toEqual([BLUE.hex, GREEN.hex]);
  });
});

describe('builderReducer — setStepCount clamps anchors (the regression this exists to prevent)', () => {
  it('pulls back every anchorStep that would exceed the new, smaller step count', () => {
    const state = synced([BLUE, GREEN], BLUE.hex);
    // Force an anchor near the top of a 10-step range.
    const withDeepAnchor: BuilderState = {
      ...state,
      scales: state.scales.map((s) => (s.hex === BLUE.hex ? { ...s, anchorStep: 8 } : s)),
    };

    const shrunk = builderReducer(withDeepAnchor, { type: 'setStepCount', count: 5 });
    const blue = shrunk.scales.find((s) => s.hex === BLUE.hex)!;
    expect(blue.anchorStep).toBeLessThanOrEqual(4);
  });

  it('never lets stepCount itself leave the 2-10 range', () => {
    const state = synced([BLUE], BLUE.hex);
    expect(builderReducer(state, { type: 'setStepCount', count: 1 }).stepCount).toBe(2);
    expect(builderReducer(state, { type: 'setStepCount', count: 99 }).stepCount).toBe(10);
  });

  it('leaves anchors already within range untouched', () => {
    const state = synced([BLUE], BLUE.hex);
    const withLowAnchor: BuilderState = {
      ...state,
      scales: state.scales.map((s) => ({ ...s, anchorStep: 2 })),
    };
    const shrunk = builderReducer(withLowAnchor, { type: 'setStepCount', count: 5 });
    expect(shrunk.scales[0]!.anchorStep).toBe(2);
  });
});

describe('builderReducer — setPrimary re-derives auto-names but respects custom ones', () => {
  it('re-labels primary/accent when the primary anchor changes', () => {
    const state = synced([BLUE, GREEN], BLUE.hex);
    const swapped = builderReducer(state, { type: 'setPrimary', hex: GREEN.hex });
    expect(swapped.scales.find((s) => s.hex === GREEN.hex)!.name).toBe('primary');
    expect(swapped.scales.find((s) => s.hex === BLUE.hex)!.name).toBe('accent-1');
  });

  it('does not overwrite a custom name when primary changes', () => {
    const state = synced([BLUE, GREEN], BLUE.hex);
    const renamed = builderReducer(state, {
      type: 'renameScale',
      hex: BLUE.hex,
      name: 'sky',
    });
    const swapped = builderReducer(renamed, { type: 'setPrimary', hex: GREEN.hex });
    expect(swapped.scales.find((s) => s.hex === BLUE.hex)!.name).toBe('sky');
  });

  it('ignores setPrimary for a hex not present in the dock', () => {
    const state = synced([BLUE], BLUE.hex);
    const unchanged = builderReducer(state, { type: 'setPrimary', hex: '#000000' });
    expect(unchanged).toBe(state);
  });
});

describe('builderReducer — per-scale curve and intensity updates', () => {
  it('setCurve stores points under the correct axis without touching the others', () => {
    const state = synced([BLUE], BLUE.hex);
    const points = [
      { x: 0, y: 0.9 },
      { x: 1, y: 0.1 },
    ];
    const next = builderReducer(state, {
      type: 'setCurve',
      hex: BLUE.hex,
      axis: 'lightness',
      points,
    });
    const blue = next.scales[0]!;
    expect(blue.lightnessCurve).toEqual(points);
    expect(blue.chromaCurve).toBeNull();
    expect(blue.hueTorsionCurve).toBeNull();
  });

  it('setHueTorsion only affects the targeted scale', () => {
    const state = synced([BLUE, GREEN], BLUE.hex);
    const next = builderReducer(state, { type: 'setHueTorsion', hex: BLUE.hex, value: 25 });
    expect(next.scales.find((s) => s.hex === BLUE.hex)!.hueTorsion).toBe(25);
    expect(next.scales.find((s) => s.hex === GREEN.hex)!.hueTorsion).toBe(0);
  });
});

describe('builderReducer — hydrateSpecs (reopening a saved palette)', () => {
  const SAVED_SPECS = [
    {
      name: 'primary',
      steps: 5,
      anchors: [{ step: 3, color: '#3b82f6' }],
      chromaIntensity: 0.7,
      hueTorsion: 15,
      lightnessCurve: [
        { x: 0, y: 0.9 },
        { x: 1, y: 0.1 },
      ],
    },
    {
      name: 'accent-1',
      steps: 5,
      anchors: [{ step: 2, color: '#22c55e' }],
    },
  ];

  it('builds scale entries directly from specs, independent of any prior dock sync', () => {
    const next = builderReducer(EMPTY_BUILDER_STATE, {
      type: 'hydrateSpecs',
      specs: SAVED_SPECS,
    });
    expect(next.scales).toHaveLength(2);
    expect(next.scales.map((s) => s.hex)).toEqual(['#3b82f6', '#22c55e']);
  });

  it('restores step count, curves, intensity, and torsion exactly', () => {
    const next = builderReducer(EMPTY_BUILDER_STATE, {
      type: 'hydrateSpecs',
      specs: SAVED_SPECS,
    });
    expect(next.stepCount).toBe(5);
    const primary = next.scales.find((s) => s.hex === '#3b82f6')!;
    expect(primary.anchorStep).toBe(3);
    expect(primary.chromaIntensity).toBe(0.7);
    expect(primary.hueTorsion).toBe(15);
    expect(primary.lightnessCurve).toEqual(SAVED_SPECS[0]!.lightnessCurve);
    expect(primary.nameIsCustom).toBe(true);
    expect(primary.name).toBe('primary');
  });

  it('defaults chromaIntensity/hueTorsion/curves when a spec omits them', () => {
    const next = builderReducer(EMPTY_BUILDER_STATE, {
      type: 'hydrateSpecs',
      specs: SAVED_SPECS,
    });
    const accent = next.scales.find((s) => s.hex === '#22c55e')!;
    expect(accent.chromaIntensity).toBe(1);
    expect(accent.hueTorsion).toBe(0);
    expect(accent.lightnessCurve).toBeNull();
  });

  it('designates the first spec as primary', () => {
    const next = builderReducer(EMPTY_BUILDER_STATE, {
      type: 'hydrateSpecs',
      specs: SAVED_SPECS,
    });
    expect(next.primaryHex).toBe('#3b82f6');
  });

  it('clamps a persisted anchorStep that no longer fits if hydrated at a smaller step count', () => {
    const specWithDeepAnchor = [
      { name: 'primary', steps: 3, anchors: [{ step: 8, color: '#3b82f6' }] },
    ];
    const next = builderReducer(EMPTY_BUILDER_STATE, {
      type: 'hydrateSpecs',
      specs: specWithDeepAnchor,
    });
    expect(next.scales[0]!.anchorStep).toBeLessThanOrEqual(2);
  });

  it('a subsequent syncFromDock preserves everything hydrateSpecs set', () => {
    const hydrated = builderReducer(EMPTY_BUILDER_STATE, {
      type: 'hydrateSpecs',
      specs: SAVED_SPECS,
    });
    const resynced = builderReducer(hydrated, {
      type: 'syncFromDock',
      items: [
        { hex: '#3b82f6', oklch: { l: 0.62, c: 0.19, h: 259 } },
        { hex: '#22c55e', oklch: { l: 0.72, c: 0.19, h: 149 } },
      ],
      primaryAnchorHex: '#3b82f6',
    });
    const primary = resynced.scales.find((s) => s.hex === '#3b82f6')!;
    expect(primary.chromaIntensity).toBe(0.7);
    expect(primary.lightnessCurve).toEqual(SAVED_SPECS[0]!.lightnessCurve);
  });
});

describe('builderReducer — global settings', () => {
  it('setGamut, setCvd, toggleMatrix, and setExportFormat update independently', () => {
    let state = EMPTY_BUILDER_STATE;
    state = builderReducer(state, { type: 'setGamut', gamut: 'p3' });
    expect(state.gamut).toBe('p3');

    state = builderReducer(state, { type: 'setCvd', cvd: 'protanopia' });
    expect(state.cvd).toBe('protanopia');

    state = builderReducer(state, { type: 'toggleMatrix' });
    expect(state.matrixOpen).toBe(true);
    state = builderReducer(state, { type: 'toggleMatrix' });
    expect(state.matrixOpen).toBe(false);

    state = builderReducer(state, { type: 'setExportFormat', format: 'shadcn' });
    expect(state.exportFormat).toBe('shadcn');
  });
});
