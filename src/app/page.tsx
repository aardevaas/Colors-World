import { Unbounded } from 'next/font/google';
import { ColorRain } from '@/components/landing/ColorRain';
import { Hero } from '@/components/landing/Hero';
import {
  composeIndex,
  indexToSwatch,
  SPECTRUM_STEPS,
  type GeneratedSwatch,
} from '@/lib/spectrum/generate-color';

const unbounded = Unbounded({
  subsets: ['latin'],
  weight: ['600', '800'],
  variable: '--font-display',
  display: 'swap',
});

// ~L 0.60 — vivid enough to read as "color" rather than pastel, dark enough
// to hold up against the hero's near-black background.
const MARQUEE_LIGHTNESS_STEP = 100;
// Maximum chroma the sRGB gamut allows at that lightness/hue — full vividness.
const MARQUEE_CHROMA_STEP = SPECTRUM_STEPS - 1;
// One full sweep of the hue wheel in 32 swatches.
const MARQUEE_HUE_INCREMENT = 8;

function buildMarqueeSwatches(): GeneratedSwatch[] {
  const swatches: GeneratedSwatch[] = [];
  for (let hueStep = 0; hueStep < SPECTRUM_STEPS; hueStep += MARQUEE_HUE_INCREMENT) {
    const index = composeIndex({
      lightnessStep: MARQUEE_LIGHTNESS_STEP,
      hueStep,
      chromaStep: MARQUEE_CHROMA_STEP,
    });
    swatches.push(indexToSwatch(index));
  }
  return swatches;
}

// Several lightness bands, not just one — "all different tones" means dark,
// light, and muted variants of every hue, not just a vivid rainbow ring.
const RAIN_LIGHTNESS_STEPS = [40, 80, 120, 160, 200] as const;
const RAIN_CHROMA_STEP = SPECTRUM_STEPS - 1;
const RAIN_HUE_INCREMENT = 24;

function buildRainSwatchHexes(): string[] {
  const hexes: string[] = [];
  for (const lightnessStep of RAIN_LIGHTNESS_STEPS) {
    for (let hueStep = 0; hueStep < SPECTRUM_STEPS; hueStep += RAIN_HUE_INCREMENT) {
      const index = composeIndex({ lightnessStep, hueStep, chromaStep: RAIN_CHROMA_STEP });
      hexes.push(indexToSwatch(index).hex);
    }
  }
  return hexes;
}

export default function LandingPage() {
  const marqueeSwatches = buildMarqueeSwatches();
  const rainSwatchHexes = buildRainSwatchHexes();

  return (
    <div className={unbounded.variable}>
      <Hero marqueeSwatches={marqueeSwatches} />
      <ColorRain swatchHexes={rainSwatchHexes} />
    </div>
  );
}
