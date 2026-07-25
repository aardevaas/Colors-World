import type { Metadata } from 'next';
import { Geist_Mono } from 'next/font/google';
import { DockProvider } from '@/lib/dock/dock-context';
import { HarmonicDock } from '@/components/dock/HarmonicDock';
import './globals.css';

export const metadata: Metadata = {
  title: 'Colors World',
  description: 'An open-source studio for color, palettes, branding, and typography.',
};

// Every page in this app reads a live session or live project data — there is
// no valid statically-prerendered version of any of them. Without this, Next
// tries to prerender pages at build time; a page that reads env vars or
// cookies before Next's dynamic-API detection kicks in (see
// server-client.ts) then throws during the build itself instead of failing
// gracefully at request time, and one bad page takes the whole deploy down
// with it.
export const dynamic = 'force-dynamic';

// Loaded here, not per-page, because the Harmonic Dock (mounted below, once,
// for every route) needs it regardless of which page it's floating over —
// a page-local font load the way the landing page loads Unbounded wouldn't
// be available on, say, /studio. A dedicated CSS variable name
// (--font-dock-mono, not the app-wide --font-mono already defined in
// globals.css) keeps this scoped to the dock's own styling rather than
// silently reflowing every other page's monospace text.
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-dock-mono',
  display: 'swap',
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={geistMono.variable}>
      <body>
        <DockProvider>
          {children}
          <HarmonicDock />
        </DockProvider>
      </body>
    </html>
  );
}
