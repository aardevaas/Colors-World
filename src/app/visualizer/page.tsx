import { Plus_Jakarta_Sans, Unbounded } from 'next/font/google';
import { AccountStatus } from '@/components/auth/AccountStatus';
import { VisualizerShell } from '@/components/visualizer/VisualizerShell';

/**
 * Loaded page-locally rather than at the root, matching /builder — per the
 * "each tab is its own world" direction, typography and atmosphere are free to
 * differ per tab while the persistent shell (dock, nav, account status) does
 * not. Geist Mono is deliberately not reloaded: it is already at the root as
 * --font-dock-mono, and this tab's numeric readouts reuse that exact variable
 * rather than fetching the same font twice.
 */
const unbounded = Unbounded({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-visualizer-display',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-visualizer-body',
  display: 'swap',
});

export default function VisualizerPage() {
  return (
    <div className={`${unbounded.variable} ${jakarta.variable}`}>
      <VisualizerShell accountSlot={<AccountStatus />} />
    </div>
  );
}
