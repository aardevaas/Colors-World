'use server';

import { commitMergeResolution } from '@/lib/supabase/merge-workflow';
import { createServerSupabaseClient } from '@/lib/supabase/server-client';
import type { PaletteSnapshot } from '@/lib/versioning';

export interface CommitResolutionInput {
  readonly paletteId: string;
  readonly oursVersionId: string;
  readonly theirsVersionId: string;
  readonly targetBranchId: string;
  readonly resolvedSnapshot: PaletteSnapshot;
}

export interface CommitResolutionResult {
  readonly versionId: string;
  readonly branchHeadVersionId: string;
}

/**
 * Server Action backing Merge Lab's "commit merge" button. Deliberately dumb:
 * it trusts the resolved snapshot it's handed and writes exactly that as a
 * two-parent merge commit. The UI is responsible for only enabling the commit
 * button once every conflict has a resolution — this action has no way to
 * tell "resolved by the user" apart from "happened to match the base value,"
 * so it doesn't try.
 */
export async function commitResolution(
  input: CommitResolutionInput
): Promise<CommitResolutionResult> {
  const supabase = await createServerSupabaseClient();
  const { version, branch } = await commitMergeResolution(
    {
      paletteId: input.paletteId,
      oursVersionId: input.oursVersionId,
      theirsVersionId: input.theirsVersionId,
      resolvedSnapshot: input.resolvedSnapshot,
      targetBranchId: input.targetBranchId,
    },
    supabase
  );

  return { versionId: version.id, branchHeadVersionId: branch.headVersionId };
}
