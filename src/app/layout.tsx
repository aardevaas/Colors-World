import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PRISM — Colour Intelligence',
  description: 'Perceptual colour engine, scale laboratory and token studio.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
