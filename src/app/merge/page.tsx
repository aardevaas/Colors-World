import { getPalette, getPaletteByName } from '@/lib/supabase/palettes';
import { previewMerge } from '@/lib/supabase/merge-workflow';
import { createServerSupabaseClient } from '@/lib/supabase/server-client';
import { MergeLab } from '@/components/merge-lab/MergeLab';

const DEMO_PALETTE_NAME = 'Demo Palette';
const DEMO_OURS_BRANCH = 'ours';
const DEMO_THEIRS_BRANCH = 'theirs';

interface PageProps {
  readonly searchParams: Promise<{
    palette?: string;
    ours?: string;
    theirs?: string;
  }>;
}

export default async function MergePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const oursBranch = params.ours ?? DEMO_OURS_BRANCH;
  const theirsBranch = params.theirs ?? DEMO_THEIRS_BRANCH;
  const supabase = await createServerSupabaseClient();

  // No ?palette= means "the smoke-testable default" — the seeded Demo
  // Palette — rather than requiring every link into this page to carry a
  // full querystring.
  const palette =
    params.palette !== undefined
      ? await getPalette(params.palette, supabase)
      : await getPaletteByName(DEMO_PALETTE_NAME, supabase);

  if (palette === null) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'ui-monospace, monospace' }}>
        <p>
          {params.palette !== undefined
            ? `No palette with id "${params.palette}".`
            : `No palette named "${DEMO_PALETTE_NAME}" found. Run the seed script first:`}
        </p>
        {params.palette === undefined && (
          <pre>npx tsx --env-file=.env.local scripts/seed-demo-palette.ts</pre>
        )}
      </main>
    );
  }

  const preview = await previewMerge(palette.id, oursBranch, theirsBranch, supabase);

  return (
    <MergeLab
      paletteId={palette.id}
      oursVersionId={preview.oursVersionId}
      theirsVersionId={preview.theirsVersionId}
      targetBranchId={preview.oursBranch.id}
      snapshot={preview.result.snapshot}
      conflicts={preview.result.conflicts}
    />
  );
}
