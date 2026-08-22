import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Unbounded } from 'next/font/google';
import { AccountStatus } from '@/components/auth/AccountStatus';
import { ComposeShell } from '@/components/compose/ComposeShell';

export const metadata: Metadata = {
  title: 'compose',
  description:
    'One color in, a whole system out — reconciled against the gamut rather than clipped to it.',
};

/**
 * Compose — where a palette is made.
 *
 * Loaded page-locally, matching the "each tab is its own world" direction:
 * Compose shares Scales' expressive stack because they are two halves of the
 * same craft, but the font is requested here rather than promoted to the root,
 * which would leak it onto /library's deliberately plain instrument pages.
 */
const unbounded = Unbounded({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-builder-display',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-builder-body',
  display: 'swap',
});

export default function ComposePage() {
  return (
    <div className={`${unbounded.variable} ${jakarta.variable}`}>
      <ComposeShell accountSlot={<AccountStatus />} />
    </div>
  );
}
