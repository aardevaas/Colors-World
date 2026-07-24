import { Unbounded } from 'next/font/google';
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

export default function LandingPage() {
  const marqueeSwatches = buildMarqueeSwatches();

  return (
    <div className={unbounded.variable}>
      <Hero marqueeSwatches={marqueeSwatches} />
    </div>
  );
}
