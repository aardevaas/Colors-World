import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ScaleSpec } from '@/lib/color-engine';
import type { PaletteSnapshot } from '@/lib/versioning';
import {
  createBranch,
  createPalette,
  createVersion,
  getBranch,
  getVersion,
  updateBranchHead,
  type PaletteBranchRecord,
  type PaletteRecord,
  type PaletteVersionRecord,
} from './palettes';

const DEFAULT_BRANCH_NAME = 'main';

/**
 * Creates a brand-new palette: a palette row, a root version with no parents,
 * and a branch (default "main") pointing at it. This is the one place a
 * version legitimately has an empty `parentIds` — every other version in the
 * system descends from this one.
 */
export async function initializePalette(
  name: string,
  snapshot: PaletteSnapshot,
  options?: {
    message?: string;
    branchName?: string;
    projectId?: string;
    builderSpecs?: readonly ScaleSpec[];
  },
  client?: SupabaseClient
): Promise<{
  palette: PaletteRecord;
  version: PaletteVersionRecord;
  branch: PaletteBranchRecord;
}> {
  const palette = await createPalette(name, client, options?.projectId);
  const version = await createVersion(
    {
      paletteId: palette.id,
      parentIds: [],
      snapshot,
      message: options?.message,
      builderSpecs: options?.builderSpecs,
    },
    client
  );
  const branch = await createBranch(
    {
      paletteId: palette.id,
      name: options?.branchName ?? DEFAULT_BRANCH_NAME,
      headVersionId: version.id,
    },
    client
  );

  return { palette, version, branch };
}

/**
 * Forks a branch: creates a new named branch pointing at the same version the
 * source branch currently points at. No new version is written — a fork is
 * free until the new branch actually diverges via `commitVersionToBranch`.
 */
export async function forkBranch(
  paletteId: string,
  sourceBranchName: string,
  newBranchName: string,
  client?: SupabaseClient
): Promise<PaletteBranchRecord> {
  const source = await getBranch(paletteId, sourceBranchName, client);
  if (source === null) {
    throw new Error(`Branch "${sourceBranchName}" does not exist on this palette.`);
  }

  const existing = await getBranch(paletteId, newBranchName, client);
  if (existing !== null) {
    throw new Error(`Branch "${newBranchName}" already exists on this palette.`);
  }

  return createBranch(
    { paletteId, name: newBranchName, headVersionId: source.headVersionId },
    client
  );
}

/**
 * Records a new version on a branch — an ordinary single-parent commit, as
 * opposed to `commitMergeResolution`'s two-parent merge commit. The new
 * version's parent is whatever the branch currently points at, and the branch
 * is fast-forwarded to it, exactly like `git commit` on the branch you have
 * checked out.
 */
export async function commitVersionToBranch(
  paletteId: string,
  branchName: string,
  snapshot: PaletteSnapshot,
  message?: string,
  client?: SupabaseClient,
  builderSpecs?: readonly ScaleSpec[]
): Promise<{ version: PaletteVersionRecord; branch: PaletteBranchRecord }> {
  const branch = await getBranch(paletteId, branchName, client);
  if (branch === null) {
    throw new Error(`Branch "${branchName}" does not exist on this palette.`);
  }

  const version = await createVersion(
    { paletteId, parentIds: [branch.headVersionId], snapshot, message, builderSpecs },
    client
  );
  const updatedBranch = await updateBranchHead(branch.id, version.id, client);

  return { version, branch: updatedBranch };
}

/** Convenience read: a branch's current snapshot (and /builder specs, if any),
 *  resolved from its head version. */
export async function getBranchSnapshot(
  paletteId: string,
  branchName: string,
  client?: SupabaseClient
): Promise<{
  branch: PaletteBranchRecord;
  snapshot: PaletteSnapshot;
  builderSpecs: readonly ScaleSpec[] | null;
} | null> {
  const branch = await getBranch(paletteId, branchName, client);
  if (branch === null) return null;

  const version = await getVersion(branch.headVersionId, client);
  if (version === null) {
    throw new Error(
      `Data inconsistency: branch "${branchName}" points at a version that no longer exists.`
    );
  }

  return { branch, snapshot: version.snapshot, builderSpecs: version.builderSpecs };
}
