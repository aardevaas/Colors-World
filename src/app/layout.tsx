import type { Metadata } from 'next';
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
