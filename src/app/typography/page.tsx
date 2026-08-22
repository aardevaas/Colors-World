import type { Metadata } from 'next';
import { AccountStatus } from '@/components/auth/AccountStatus';
import { TypographyShell } from '@/components/typography/TypographyShell';

export const metadata: Metadata = {
  title: 'typography',
  description:
    'Type and color judged together, because neither is legible on its own.',
};

/**
 * No next/font here, unlike /builder and /visualizer. This tab's whole purpose
 * is loading arbitrary families at runtime — from Google, Fontshare, or the
 * visitor's own machine — so pinning a build-time subset would fight the
 * feature. Preset stylesheets are injected on demand by font-sources.ts.
 */
export default function TypographyPage() {
  return <TypographyShell accountSlot={<AccountStatus />} />;
}
