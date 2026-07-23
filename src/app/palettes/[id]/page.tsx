import { notFound } from 'next/navigation';
import { getPalette, listBranches } from '@/lib/supabase/palettes';
import { getBranchSnapshot } from '@/lib/supabase/branch-workflow';
import { createServerSupabaseClient } from '@/lib/supabase/server-client';
import { PaletteDetail } from '@/components/palette-detail/PaletteDetail';

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

export default async function PaletteDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const palette = await getPalette(id, supabase);
  if (palette === null) notFound();

  const branches = await listBranches(id, supabase);
  const resolved = await Promise.all(
    branches.map(async (branch) => {
      const result = await getBranchSnapshot(id, branch.name, supabase);
      // listBranches and getBranchSnapshot just read the same row a moment
      // apart — a null here means the branch was deleted concurrently, not a
      // bug in this page, so surfacing it loudly is correct.
      if (result === null) {
        throw new Error(`Branch "${branch.name}" disappeared between reads.`);
      }
      return { id: branch.id, name: branch.name, snapshot: result.snapshot };
    })
  );

  return <PaletteDetail paletteId={palette.id} paletteName={palette.name} branches={resolved} />;
}
