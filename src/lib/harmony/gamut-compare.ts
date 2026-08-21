/**
 * The same scale, as three different displays can actually show it.
 *
 * A designer on a P3 laptop builds a ramp whose top steps are more saturated
 * than sRGB can reach. Nothing warns them, because on their screen it is
 * correct. On a cheap monitor those steps are mapped down — and mapping is not
 * a uniform dimming, it pulls chroma until the color fits, which means two
 * steps that were distinct can arrive at nearly the same place. The ramp loses
 * its top end, and the person who made it never sees it happen.
 *
 * That is the finding here: not "these colors are out of gamut", which the
 * step badges already say, but **which neighbouring steps stop being different**
 * on a narrower display. A step shifting on its own is usually fine — the
 * whole ramp shifting together still reads as a ramp. Two steps landing on top
 * of each other is what destroys it.
 *
 * Pure: no DOM, no React.
 */

import {
  deltaEOk,
  generateScale,
  type Gamut,
  type Oklch,
  type ScaleSpec,
} from '@/lib/color-engine';

/** The three display gamuts, widest first. Print is a different question and
 *  has its own retention model in the engine. */
export const DISPLAY_GAMUTS: readonly Gamut[] = ['rec2020', 'p3', 'srgb'];

/**
 * Two steps closer than this read as one. The same just-noticeable-difference
 * figure the color-vision report uses, for the same reason: a ramp whose
 * neighbours are indistinguishable has lost a step whatever caused it.
 */
export const COLLAPSE_DISTANCE = 0.04;
/** Below this, a step has moved but not enough for anyone to notice. */
export const SHIFT_DISTANCE = 0.01;

export interface GamutRendering {
  readonly gamut: Gamut;
  readonly hex: string;
  readonly oklch: Oklch;
  /** The engine had to reduce chroma to make this step displayable here. */
  readonly clamped: boolean;
  /** OKLab distance from the widest gamut's version of the same step. */
  readonly lossFromWidest: number;
}

export interface GamutStepComparison {
  readonly step: number;
  readonly renderings: readonly GamutRendering[];
  /** True when a narrower display visibly moves this step. */
  readonly shifts: boolean;
}

/** Two neighbouring steps that stop being distinguishable on a gamut. */
export interface StepCollapse {
  readonly gamut: Gamut;
  readonly lower: number;
  readonly upper: number;
  readonly distance: number;
  /** The distance the same pair had on the widest gamut. */
  readonly widestDistance: number;
}

export interface GamutComparison {
  readonly gamuts: readonly Gamut[];
  readonly steps: readonly GamutStepComparison[];
  /** Steps a narrower display cannot reproduce. */
  readonly shifting: readonly GamutStepComparison[];
  /** The real damage, worst first. */
  readonly collapses: readonly StepCollapse[];
  readonly widest: Gamut;
}

export function compareAcrossGamuts(
  spec: ScaleSpec,
  gamuts: readonly Gamut[] = DISPLAY_GAMUTS
): GamutComparison {
  const ordered = gamuts.length > 0 ? gamuts : DISPLAY_GAMUTS;
  const widest = ordered[0]!;

  const scales = ordered.map((gamut) => ({ gamut, scale: generateScale({ ...spec, gamut }) }));
  const reference = scales[0]!.scale;

  const steps = reference.steps.map((referenceStep, index): GamutStepComparison => {
    const renderings = scales.map(({ gamut, scale }): GamutRendering => {
      const step = scale.steps[index]!;
      return {
        gamut,
        hex: step.hex,
        oklch: step.oklch,
        clamped: step.gamutClamped,
        lossFromWidest: deltaEOk(referenceStep.oklch, step.oklch),
      };
    });
    return {
      step: referenceStep.step,
      renderings,
      shifts: renderings.some((r) => r.lossFromWidest > SHIFT_DISTANCE),
    };
  });

  return {
    gamuts: ordered,
    steps,
    shifting: steps.filter((step) => step.shifts),
    collapses: findCollapses(scales, widest),
    widest,
  };
}

function findCollapses(
  scales: readonly { readonly gamut: Gamut; readonly scale: ReturnType<typeof generateScale> }[],
  widest: Gamut
): StepCollapse[] {
  const reference = scales.find((entry) => entry.gamut === widest)!.scale;
  const collapses: StepCollapse[] = [];

  for (const { gamut, scale } of scales) {
    if (gamut === widest) continue;
    for (let i = 1; i < scale.steps.length; i += 1) {
      const lower = scale.steps[i - 1]!;
      const upper = scale.steps[i]!;
      const distance = deltaEOk(lower.oklch, upper.oklch);
      if (distance >= COLLAPSE_DISTANCE) continue;

      const widestDistance = deltaEOk(reference.steps[i - 1]!.oklch, reference.steps[i]!.oklch);
      // The pair has to have been comfortably distinct to begin with, not
      // merely above the threshold. A pair at 0.049 dropping to 0.037 is two
      // marginal steps getting slightly more marginal, and calling that a
      // merge would be crying wolf -- reporting a problem the display did not
      // cause and the person cannot meaningfully fix.
      if (widestDistance < COLLAPSE_DISTANCE * 2) continue;

      collapses.push({ gamut, lower: lower.step, upper: upper.step, distance, widestDistance });
    }
  }

  return collapses.sort((a, b) => a.distance - b.distance);
}
