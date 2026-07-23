import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  findLowestCommonAncestor,
  threeWayMerge,
  type MergeResult,
  type PaletteSnapshot,
  type VersionNode,
} from '@/lib/versioning';
import {
  createVersion,
  getBranch,
  getVersion,
  listVersions,
  updateBranchHead,
  type PaletteBranchRecord,
  type PaletteVersionRecord,
} from './palettes';

/**
 * Builds the `VersionNode` map `findLowestCommonAncestor` walks — every
 * version for a palette, reduced to just id + parents. Loading the whole
 * palette's history for one merge is wasteful past a few thousand versions,
 * but simple and correct; revisit with a bounded ancestor walk (stop once
 * both BFS frontiers are exhausted past each other) if that ever matters.
 */
export async function loadVersionGraph(
  paletteId: string,
  client?: SupabaseClient
): Promise<Map<string, VersionNode>> {
  const versions = await listVersions(paletteId, client);
  return new Map(versions.map((v) => [v.id, { id: v.id, parentIds: v.parentIds }]));
}

export interface MergePreview {
  readonly paletteId: string;
  readonly oursBranch: PaletteBranchRecord;
  readonly theirsBranch: PaletteBranchRecord;
  readonly baseVersionId: string;
  readonly oursVersionId: string;
  readonly theirsVersionId: string;
  readonly result: MergeResult;
}

/**
 * Computes what merging `theirsBranchName` into `oursBranchName` would
 * produce, without writing anything. This is the dry-run the UI shows before
 * a human resolves conflicts — no version or branch update happens until
 * `commitMergeResolution` is called explicitly with the resolved snapshot.
 */
export async function previewMerge(
  paletteId: string,
  oursBranchName: string,
  theirsBranchName: string,
  client?: SupabaseClient
): Promise<MergePreview> {
  const [oursBranch, theirsBranch] = await Promise.all([
    getBranch(paletteId, oursBranchName, client),
    getBranch(paletteId, theirsBranchName, client),
  ]);

  if (oursBranch === null) {
    throw new Error(`Branch "${oursBranchName}" does not exist on this palette.`);
  }
  if (theirsBranch === null) {
    throw new Error(`Branch "${theirsBranchName}" does not exist on this palette.`);
  }

  const graph = await loadVersionGraph(paletteId, client);
  const baseVersionId = findLowestCommonAncestor(
    graph,
    oursBranch.headVersionId,
    theirsBranch.headVersionId
  );

  if (baseVersionId === null) {
    throw new Error(
      `"${oursBranchName}" and "${theirsBranchName}" share no common ancestor — ` +
        'they are disjoint histories and cannot be three-way merged.'
    );
  }

  const [base, ours, theirs] = await Promise.all([
    getVersion(baseVersionId, client),
    getVersion(oursBranch.headVersionId, client),
    getVersion(theirsBranch.headVersionId, client),
  ]);

  // These three ids all came from the graph/branches we just loaded, so a
  // miss here means the DB is inconsistent (a branch pointing at a version
  // that no longer exists) rather than anything the caller did wrong.
  if (base === null || ours === null || theirs === null) {
    throw new Error(
      `Data inconsistency: could not load one of base/ours/theirs versions ` +
        `for the merge of "${oursBranchName}" and "${theirsBranchName}".`
    );
  }

  return {
    paletteId,
    oursBranch,
    theirsBranch,
    baseVersionId: base.id,
    oursVersionId: ours.id,
    theirsVersionId: theirs.id,
    result: threeWayMerge(base.snapshot, ours.snapshot, theirs.snapshot),
  };
}

export interface CommitMergeInput {
  readonly paletteId: string;
  readonly oursVersionId: string;
  readonly theirsVersionId: string;
  /** The merge's snapshot with every conflict's chosen resolution applied. */
  readonly resolvedSnapshot: PaletteSnapshot;
  /** The branch whose head moves to the new merge commit — conventionally "ours". */
  readonly targetBranchId: string;
  readonly message?: string;
}

/**
 * Writes the resolved merge as a new version with two parents (a merge
 * commit, in DAG terms) and fast-forwards the target branch to point at it.
 * Callers are responsible for having actually resolved every conflict first —
 * this function commits whatever snapshot it's given and does not re-check
 * for unresolved conflicts, since "resolved" is a UI-level judgment
 * (`resolutions[token] !== undefined`) that has no meaning at this layer.
 */
export async function commitMergeResolution(
  input: CommitMergeInput,
  client?: SupabaseClient
): Promise<{ version: PaletteVersionRecord; branch: PaletteBranchRecord }> {
  const version = await createVersion(
    {
      paletteId: input.paletteId,
      parentIds: [input.oursVersionId, input.theirsVersionId],
      snapshot: input.resolvedSnapshot,
      message: input.message ?? 'Merge',
    },
    client
  );

  const branch = await updateBranchHead(input.targetBranchId, version.id, client);

  return { version, branch };
}
