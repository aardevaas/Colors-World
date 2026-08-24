'use server';

import {
  commitVersionToBranch,
  forkBranch,
  getBranchSnapshot,
  initializePalette,
} from '@/lib/supabase/branch-workflow';
import { createBoardItem, listBoardItems, nextBoardPosition } from '@/lib/supabase/board';
import { currentProjectId } from '@/lib/supabase/require-project';
import { createServerSupabaseClient } from '@/lib/supabase/server-client';
import type { ScaleSpec } from '@/lib/color-engine';
import type { PaletteSnapshot } from '@/lib/versioning';

export interface CreatePaletteResult {
  readonly paletteId: string;
  readonly branchId: string;
}

/**
 * Persists a generated-scale snapshot as a brand-new palette on "main".
 * `builderSpecs`, when supplied (from /builder), is stored alongside the
 * resolved snapshot so the palette reopens editable — its curves, hue
 * torsion, and chroma intensity survive, not just the flattened hex values.
 * Optional and separate from `snapshot` because not every save has one (a
 * hand-edited swatch, a merge resolution): there's nothing to store, not a
 * gap to paper over.
 */
export async function createPaletteFromScale(
  name: string,
  snapshot: PaletteSnapshot,
  builderSpecs?: readonly ScaleSpec[]
): Promise<CreatePaletteResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) {
    throw new Error('You must be signed in to save a palette.');
  }

  const projectId = await currentProjectId(user.id, supabase);

  const { palette, branch } = await initializePalette(
    name,
    snapshot,
    { message: 'Created from Scale Lab', projectId, builderSpecs },
    supabase
  );

  // Pin it to the Studio Wall automatically — saving a palette is the moment
  // it becomes a real thing in the project, not a separate "add to board" step.
  const existingItems = await listBoardItems(projectId, supabase);
  await createBoardItem(
    {
      projectId,
      itemType: 'palette',
      refId: palette.id,
      ...nextBoardPosition(existingItems.length),
    },
    supabase
  );

  return { paletteId: palette.id, branchId: branch.id };
}

export interface ForkBranchResult {
  readonly branchId: string;
  readonly branchName: string;
}

export async function forkBranchAction(
  paletteId: string,
  sourceBranchName: string,
  newBranchName: string
): Promise<ForkBranchResult> {
  const supabase = await createServerSupabaseClient();
  const branch = await forkBranch(paletteId, sourceBranchName, newBranchName, supabase);
  return { branchId: branch.id, branchName: branch.name };
}

export interface EditSwatchResult {
  readonly versionId: string;
}

/**
 * Reads a branch's current snapshot, overwrites one token, and commits the
 * result as a new version on that branch. This is deliberately the smallest
 * possible "edit" primitive — enough to make two forked branches actually
 * diverge so there's something real to merge, without building a full
 * multi-scale palette editor.
 */
export async function editSwatchAction(
  paletteId: string,
  branchName: string,
  token: string,
  hex: string
): Promise<EditSwatchResult> {
  const supabase = await createServerSupabaseClient();
  const current = await getBranchSnapshot(paletteId, branchName, supabase);
  if (current === null) {
    throw new Error(`Branch "${branchName}" does not exist on this palette.`);
  }

  const { version } = await commitVersionToBranch(
    paletteId,
    branchName,
    { ...current.snapshot, [token]: hex },
    `Edit ${token}`,
    supabase
  );

  return { versionId: version.id };
}
