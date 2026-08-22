import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Unbounded } from 'next/font/google';
import { AccountStatus } from '@/components/auth/AccountStatus';
import { BuilderShell } from '@/components/builder/BuilderShell';
import { getBranchSnapshot } from '@/lib/supabase/branch-workflow';
import { createServerSupabaseClient } from '@/lib/supabase/server-client';
import type { ScaleSpec } from '@/lib/color-engine';

export const metadata: Metadata = {
  title: 'scales',
  description:
    'Every color deepened into a ramp, with sRGB, Display P3 and Rec2020 marked at every step.',
};

const MAIN_BRANCH = 'main';

/**
 * Loaded page-locally, not promoted to the root layout — per the "each tab
 * is its own world" direction (2026-07-25): typography and atmosphere are
 * free to differ per tab, but the persistent shell (Harmonic Dock, account
 * status, nav) must not. Promoting these to the root would leak /builder's
 * expressive stack onto /library's deliberately-plain, zero-web-font
 * "laboratory instrument" pages. Geist Mono is NOT reloaded here — it's
 * already at the root as --font-dock-mono for the dock, and /builder's own
 * hex/OKLCH/contrast readouts reuse that exact variable (see
 * builder.module.css) rather than fetching the same font twice.
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

interface BuilderPageProps {
  /** ?palette=<id> reopens a previously saved palette editable — its
   *  ScaleSpecs (curves, torsion, chroma intensity), not just the flattened
   *  hex values. Absent for the ordinary "start from the dock" flow. */
  readonly searchParams: Promise<{ palette?: string }>;
}

export default async function BuilderPage({ searchParams }: BuilderPageProps) {
  const { palette: paletteId } = await searchParams;
  const initialSpecs = paletteId !== undefined ? await loadBuilderSpecs(paletteId) : null;

  return (
    <div className={`${unbounded.variable} ${jakarta.variable}`}>
      <BuilderShell accountSlot={<AccountStatus />} initialSpecs={initialSpecs} />
    </div>
  );
}

async function loadBuilderSpecs(paletteId: string): Promise<readonly ScaleSpec[] | null> {
  const supabase = await createServerSupabaseClient();
  const result = await getBranchSnapshot(paletteId, MAIN_BRANCH, supabase);
  return result?.builderSpecs ?? null;
}
