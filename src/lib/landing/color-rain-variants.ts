import {
  composeIndex,
  indexToSwatch,
  SPECTRUM_STEPS,
  type GeneratedSwatch,
} from '@/lib/spectrum/generate-color';

/**
 * Each hue in the Hero's marquee becomes a "faucet": this expands one hue
 * into a family of shade variants (dark to light, a little hue jitter),
 * using the exact same 16.7M-colour arithmetic as the marquee and the
 * Spectrum itself — nothing here is a separate palette or colour system.
 */

export interface RainBlockSeed {
  readonly swatch: GeneratedSwatch;
  readonly sourceHueIndex: number;
  readonly totalHues: number;
  readonly shadeIndex: number;
  readonly variantsPerHue: number;
}

const VARIANTS_PER_HUE = 12;
// Spread across the lightness range — order doesn't matter, only coverage.
const LIGHTNESS_STEP_SPREAD = [40, 64, 88, 112, 136, 160, 184, 202, 218, 232, 244, 252] as const;
const HUE_JITTER_STEPS = 3;
const CHROMA_VARIANCE_STEPS = 20;

export function buildRainBlockSeeds(marqueeHueSteps: readonly number[]): RainBlockSeed[] {
  const totalHues = marqueeHueSteps.length;
  if (totalHues === 0) return [];

  const seeds: RainBlockSeed[] = [];

  // Interleaved round-robin — variant 0 of every hue, then variant 1 of
  // every hue, and so on — so every hue is raining from the very first
  // spawned block instead of raining hue-by-hue in sequence.
  for (let shadeIndex = 0; shadeIndex < VARIANTS_PER_HUE; shadeIndex += 1) {
    for (let sourceHueIndex = 0; sourceHueIndex < totalHues; sourceHueIndex += 1) {
      const baseHueStep = marqueeHueSteps[sourceHueIndex] ?? 0;
      const jitter = Math.round((Math.random() - 0.5) * 2 * HUE_JITTER_STEPS);
      const hueStep = (baseHueStep + jitter + SPECTRUM_STEPS) % SPECTRUM_STEPS;
      const lightnessStep = LIGHTNESS_STEP_SPREAD[shadeIndex] ?? Math.floor(SPECTRUM_STEPS / 2);
      const chromaStep = SPECTRUM_STEPS - 1 - Math.floor(Math.random() * CHROMA_VARIANCE_STEPS);
      const index = composeIndex({ lightnessStep, hueStep, chromaStep });

      seeds.push({
        swatch: indexToSwatch(index),
        sourceHueIndex,
        totalHues,
        shadeIndex,
        variantsPerHue: VARIANTS_PER_HUE,
      });
    }
  }

  return seeds;
}
