import { describe, expect, it } from 'vitest';
import { isInGamut, maxChroma, parseColor, type ScaleSpec } from '@/lib/color-engine';
import { defaultAnchorStepFor } from '@/lib/builder/builder-reducer';
import {
  COLLAPSE_DISTANCE,
  DISPLAY_GAMUTS,
  compareAcrossGamuts,
} from '../gamut-compare';

/** An ordinary ramp: lightness travels the full range, as the engine defaults. */
function ordinary(color: string, chromaIntensity = 1): ScaleSpec {
  return { name: 'test', anchors: [{ color, step: 5 }], chromaIntensity };
}

/**
 * A ramp whose steps are separated mainly by chroma rather than lightness —
 * exactly what gamut mapping takes away. This is the shape that breaks.
 */
function chromaLed(color: string): ScaleSpec {
  return {
    name: 'test',
    anchors: [{ color, step: 5 }],
    lightness: [0.62, 0.55],
    chromaIntensity: 1.8,
  };
}

describe('compareAcrossGamuts — shape', () => {
  it('renders every step in every requested gamut', () => {
    const comparison = compareAcrossGamuts(ordinary('#7C5CFF'));
    expect(comparison.gamuts).toEqual(DISPLAY_GAMUTS);
    for (const step of comparison.steps) {
      expect(step.renderings.map((r) => r.gamut)).toEqual(DISPLAY_GAMUTS);
    }
  });

  it('renders each step inside the gamut it claims', () => {
    // Tolerance rather than a strict predicate, and deliberately so. An
    // anchor colour is pinned rather than generated, so one whose chroma sits
    // exactly on the gamut hull round-trips through OKLCH landing a hair
    // outside it: measured at 1.65e-5 over the sRGB ceiling for #00C8D7,
    // roughly a hundredth of what 8-bit hex can even represent, and the
    // emitted hex is identical either way. Asserting strict containment would
    // be asserting the absence of floating-point error, not a colour fact.
    const EPSILON = 1e-4;
    for (const step of compareAcrossGamuts(ordinary('#00C8D7', 1.6)).steps) {
      for (const rendering of step.renderings) {
        if (isInGamut(rendering.oklch, rendering.gamut)) continue;
        const ceiling = maxChroma(rendering.oklch.l, rendering.oklch.h, rendering.gamut);
        expect(rendering.oklch.c - ceiling).toBeLessThan(EPSILON);
      }
    }
  });

  it('measures loss against the widest gamut, which is itself zero', () => {
    const comparison = compareAcrossGamuts(ordinary('#FF0000', 1.6));
    for (const step of comparison.steps) {
      const widest = step.renderings.find((r) => r.gamut === comparison.widest)!;
      expect(widest.lossFromWidest).toBe(0);
    }
  });

  it('falls back to the display gamuts when handed an empty list', () => {
    expect(compareAcrossGamuts(ordinary('#7C5CFF'), []).gamuts).toEqual(DISPLAY_GAMUTS);
  });

  it('is deterministic', () => {
    expect(compareAcrossGamuts(ordinary('#19D368'))).toEqual(
      compareAcrossGamuts(ordinary('#19D368'))
    );
  });
});

describe('compareAcrossGamuts — what narrowing costs', () => {
  it('finds steps a narrower display cannot reproduce', () => {
    // Measured: a red ramp pushed toward the ceiling moves 9 of its 10 steps,
    // by up to ΔE 0.134, between Rec2020 and sRGB.
    const comparison = compareAcrossGamuts(ordinary('#FF0000', 1.6));
    expect(comparison.shifting.length).toBeGreaterThan(5);
    const worst = Math.max(
      ...comparison.steps.flatMap((s) => s.renderings.map((r) => r.lossFromWidest))
    );
    expect(worst).toBeGreaterThan(0.05);
  });

  it('leaves a colour sRGB covers well alone', () => {
    // Not everything suffers. A ramp already inside sRGB has nothing to lose,
    // and reporting otherwise would make the panel meaningless.
    const comparison = compareAcrossGamuts({
      name: 'muted',
      anchors: [{ color: '#7C5CFF', step: 5 }],
      chromaIntensity: 0.4,
    });
    expect(comparison.shifting).toEqual([]);
    expect(comparison.collapses).toEqual([]);
  });
});

describe('compareAcrossGamuts — the collapse, which is the real damage', () => {
  it('catches two steps arriving at the same place on a narrower display', () => {
    // Measured on a chroma-led cyan ramp: steps 4 and 5 sit ΔE 0.103 apart in
    // Rec2020 and 0.0049 apart in sRGB. Twenty-one times closer — two clearly
    // separate steps become one, and the person who made it never sees that
    // happen on their own screen.
    const collapses = compareAcrossGamuts(chromaLed('#00C8D7')).collapses;
    expect(collapses.length).toBeGreaterThan(0);

    const worst = collapses[0]!;
    expect(worst.gamut).toBe('srgb');
    expect(worst.distance).toBeLessThan(COLLAPSE_DISTANCE);
    expect(worst.widestDistance).toBeGreaterThan(COLLAPSE_DISTANCE * 2);
  });

  it('reports the collapse for green too, and not for red', () => {
    // Red is well covered by sRGB, so the same ramp shape survives it. A
    // detector that fired on everything would be measuring the ramp, not the
    // gamut.
    expect(compareAcrossGamuts(chromaLed('#19D368')).collapses.length).toBeGreaterThan(0);
    expect(compareAcrossGamuts(chromaLed('#FF0000')).collapses).toEqual([]);
  });

  it('does not blame the display for two steps that were always similar', () => {
    // A ramp with neighbouring steps already indistinguishable at the widest
    // gamut has a scale problem, not a display one.
    for (const collapse of compareAcrossGamuts(chromaLed('#00C8D7')).collapses) {
      expect(collapse.widestDistance).toBeGreaterThanOrEqual(COLLAPSE_DISTANCE);
    }
  });

  it('finds nothing in an ordinary lightness-led ramp', () => {
    // Worth asserting because it is the product's own quality claim: scales
    // that travel through lightness survive gamut narrowing. They shift, and
    // they keep their steps.
    for (const hex of ['#00C8D7', '#FF0000', '#19D368', '#7C5CFF']) {
      const comparison = compareAcrossGamuts(ordinary(hex, 1.8));
      expect(comparison.collapses).toEqual([]);
      expect(comparison.shifting.length).toBeGreaterThan(0);
    }
  });

  it('sorts the worst collapse first', () => {
    const collapses = compareAcrossGamuts(chromaLed('#00C8D7')).collapses;
    for (let i = 1; i < collapses.length; i += 1) {
      expect(collapses[i]!.distance).toBeGreaterThanOrEqual(collapses[i - 1]!.distance);
    }
  });

  it('never reports a collapse against the widest gamut itself', () => {
    for (const collapse of compareAcrossGamuts(chromaLed('#00C8D7')).collapses) {
      expect(collapse.gamut).not.toBe('rec2020');
    }
  });
});

describe('the guarantee this whole comparison exists to check', () => {
  it('no scale the tool can currently build loses a step on sRGB', () => {
    // Swept across every combination the Scales room can actually produce --
    // and with the anchor step the UI *derives* from the colour, not a
    // hand-picked middle, which is the detail that made an earlier sweep
    // overstate reachability. Zero of 1,728 configurations collapse.
    //
    // That is the product's strongest gamut claim, and it is a consequence of
    // the ramp travelling the full lightness range: chroma is what a narrower
    // display takes away, and these ramps do not depend on chroma to keep
    // their steps apart. This is the regression guard for it -- if the
    // generator ever stops travelling through lightness, this fails loudly
    // rather than shipping ramps that quietly break on cheaper monitors.
    const hexes = [
      '#00C8D7', '#FF0000', '#19D368', '#7C5CFF', '#FFB454', '#FF00FF',
      '#0000FF', '#00FF00', '#00FFFF', '#FFFF00', '#FF7F00', '#7FFF00',
    ];
    let checked = 0;
    for (const hex of hexes) {
      for (const chromaIntensity of [0.25, 0.5, 1, 1.4, 1.8, 2]) {
        for (const steps of [3, 5, 7, 10]) {
          for (const hueTorsion of [0, 30, 60, -60, 120, 180]) {
            checked += 1;
            const comparison = compareAcrossGamuts({
              name: 'sweep',
              anchors: [{ color: hex, step: defaultAnchorStepFor(parseColor(hex), steps) }],
              steps,
              chromaIntensity,
              hueTorsion,
            });
            expect(comparison.collapses).toEqual([]);
          }
        }
      }
    }
    expect(checked).toBe(1728);
  });
});
