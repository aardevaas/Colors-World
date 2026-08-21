import {
  JetBrains_Mono,
  Plus_Jakarta_Sans,
  Rubik_Wet_Paint,
  Unbounded,
} from 'next/font/google';
import { LandingExperience } from '@/components/landing/LandingExperience';
import { CredibilityStrip } from '@/components/landing/CredibilityStrip';
import { SiteFooter } from '@/components/landing/SiteFooter';

/**
 * next/font self-hosts these at build time — no runtime request to Google, no
 * FOUT, and no layout shift while the WebGL stage initialises. That covers
 * what @fontsource would have given us without the extra dependencies.
 */
const unbounded = Unbounded({
  subsets: ['latin'],
  weight: ['600', '800'],
  variable: '--font-display',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-body',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

/*
 * Exists for exactly one word, in one state.
 *
 * The typography room sets its name in the house face like every other room,
 * and swaps to this on hover. The house rule is at most two families without a
 * clear reason; a room whose claim is that contrast is a property of type,
 * demonstrating it on its own nameplate, is the reason.
 *
 * This replaced a three-family "hand-set" nameplate that put a different face
 * on every letter. That cost ~70kb and looked like a ransom note. One face,
 * one weight, ~28kb, and it only has to be right in a single state.
 *
 * Wet Paint rather than a serif or a didone because the page already rains
 * paint into these rooms — the nameplate running on hover is the site's own
 * motif arriving somewhere it means something.
 */
const rubikWetPaint = Rubik_Wet_Paint({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-paint',
  display: 'swap',
});

export default function LandingPage() {
  return (
    <div
      className={[
        unbounded.variable,
        jakarta.variable,
        jetbrainsMono.variable,
        rubikWetPaint.variable,
      ].join(' ')}
    >
      <a href="#main" className="skipLink">
        Skip to content
      </a>
      <LandingExperience credibility={<CredibilityStrip />} footer={<SiteFooter />} />
    </div>
  );
}
