import {
  Archivo_Black,
  Caveat,
  Instrument_Serif,
  JetBrains_Mono,
  Plus_Jakarta_Sans,
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
 * The three below exist for exactly one word.
 *
 * The house rule is at most two families without a clear reason, and this is
 * the reason: the typography room sets its own name in mixed type, one face per
 * letter, because a room that claims contrast is a property of type should be
 * willing to demonstrate it on the way in rather than assert it.
 *
 * Kept to three additions rather than the six the effect could use, at one
 * weight each — roughly 70kb of self-hosted woff2 between them, all
 * `display: swap`, none of it blocking. A serif, a heavy grotesque and a
 * handwriting face cover the widest span of character for the fewest files;
 * further variety comes from weight, slope and size against the three families
 * the page already loads.
 */
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});

const archivoBlack = Archivo_Black({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-grotesque',
  display: 'swap',
});

const caveat = Caveat({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-hand',
  display: 'swap',
});

export default function LandingPage() {
  return (
    <div
      className={[
        unbounded.variable,
        jakarta.variable,
        jetbrainsMono.variable,
        instrumentSerif.variable,
        archivoBlack.variable,
        caveat.variable,
      ].join(' ')}
    >
      <a href="#main" className="skipLink">
        Skip to content
      </a>
      <LandingExperience credibility={<CredibilityStrip />} footer={<SiteFooter />} />
    </div>
  );
}
