import { JetBrains_Mono, Plus_Jakarta_Sans, Unbounded } from 'next/font/google';
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

export default function LandingPage() {
  return (
    <div className={`${unbounded.variable} ${jakarta.variable} ${jetbrainsMono.variable}`}>
      <a href="#main" className="skipLink">
        Skip to content
      </a>
      <LandingExperience
        belowTheFold={
          <>
            <CredibilityStrip />
            <SiteFooter />
          </>
        }
      />
    </div>
  );
}
