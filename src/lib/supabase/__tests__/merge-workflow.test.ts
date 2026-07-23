import { describe, expect, test } from 'vitest';
import { createBranch, createPalette, createVersion, getVersion } from '../palettes';
import { commitMergeResolution, loadVersionGraph, previewMerge } from '../merge-workflow';
import { createFakeSupabaseClient } from './fake-client';

/**
 * Sets up: base (brand-5, accent-5) → ours (brand-5 edited) and
 *          base → theirs (brand-5 edited differently, accent-5 edited)
 * — the same scenario proven in versioning's integration tests, now driven
 * through real persistence instead of in-memory objects.
 */
async function buildDivergedScenario(client: ReturnType<typeof createFakeSupabaseClient>) {
  const palette = await createPalette('brand', client);

  const base = await createVersion(
    { paletteId: palette.id, parentIds: [], snapshot: { 'brand-5': '#3b82f6', 'accent-5': '#ef4444' } },
    client
  );

  const oursHead = await createVersion(
    {
      paletteId: palette.id,
      parentIds: [base.id],
      snapshot: { 'brand-5': '#2563eb', 'accent-5': '#ef4444' },
    },
    client
  );

  const theirsHead = await createVersion(
    {
      paletteId: palette.id,
      parentIds: [base.id],
      snapshot: { 'brand-5': '#1d4ed8', 'accent-5': '#f97316' },
    },
    client
  );

  const oursBranch = await createBranch(
    { paletteId: palette.id, name: 'ours', headVersionId: oursHead.id },
    client
  );
  const theirsBranch = await createBranch(
    { paletteId: palette.id, name: 'theirs', headVersionId: theirsHead.id },
    client
  );

  return { palette, base, oursHead, theirsHead, oursBranch, theirsBranch };
}

describe('loadVersionGraph', () => {
  test('reduces every version to id and parentIds', async () => {
    const client = createFakeSupabaseClient();
    const { palette, base, oursHead } = await buildDivergedScenario(client);

    const graph = await loadVersionGraph(palette.id, client);
    expect(graph.get(base.id)).toEqual({ id: base.id, parentIds: [] });
    expect(graph.get(oursHead.id)).toEqual({ id: oursHead.id, parentIds: [base.id] });
  });
});

describe('previewMerge', () => {
  test('finds the fork point and surfaces the real conflict', async () => {
    const client = createFakeSupabaseClient();
    const { palette, base, oursHead, theirsHead } = await buildDivergedScenario(client);

    const preview = await previewMerge(palette.id, 'ours', 'theirs', client);

    expect(preview.baseVersionId).toBe(base.id);
    expect(preview.oursVersionId).toBe(oursHead.id);
    expect(preview.theirsVersionId).toBe(theirsHead.id);
    expect(preview.result.conflicts).toHaveLength(1);
    expect(preview.result.conflicts[0]!.token).toBe('brand-5');
    // accent-5 only changed on "theirs", so it merges in cleanly.
    expect(preview.result.snapshot['accent-5']).toBe('#f97316');
  });

  test('throws a clear error when a branch does not exist', async () => {
    const client = createFakeSupabaseClient();
    const { palette } = await buildDivergedScenario(client);

    await expect(previewMerge(palette.id, 'ours', 'nonexistent', client)).rejects.toThrow(
      /nonexistent.*does not exist/
    );
  });

  test('throws when histories are disjoint', async () => {
    const client = createFakeSupabaseClient();
    const palette = await createPalette('brand', client);

    const a = await createVersion({ paletteId: palette.id, parentIds: [], snapshot: {} }, client);
    const b = await createVersion({ paletteId: palette.id, parentIds: [], snapshot: {} }, client);
    await createBranch({ paletteId: palette.id, name: 'a', headVersionId: a.id }, client);
    await createBranch({ paletteId: palette.id, name: 'b', headVersionId: b.id }, client);

    await expect(previewMerge(palette.id, 'a', 'b', client)).rejects.toThrow(
      /disjoint histories/
    );
  });
});

describe('commitMergeResolution', () => {
  test('writes a two-parent merge commit and fast-forwards the target branch', async () => {
    const client = createFakeSupabaseClient();
    const { palette, oursHead, theirsHead, oursBranch } = await buildDivergedScenario(client);
    const preview = await previewMerge(palette.id, 'ours', 'theirs', client);

    // Resolve the one conflict by picking "theirs".
    const resolvedSnapshot = { ...preview.result.snapshot, 'brand-5': '#1d4ed8' };

    const { version, branch } = await commitMergeResolution(
      {
        paletteId: palette.id,
        oursVersionId: preview.oursVersionId,
        theirsVersionId: preview.theirsVersionId,
        resolvedSnapshot,
        targetBranchId: oursBranch.id,
        message: 'test merge',
      },
      client
    );

    expect(version.parentIds).toEqual([oursHead.id, theirsHead.id]);
    expect(version.snapshot).toEqual(resolvedSnapshot);
    expect(version.message).toBe('test merge');
    expect(branch.headVersionId).toBe(version.id);

    // And it's really persisted, not just returned.
    expect(await getVersion(version.id, client)).toEqual(version);
  });
});
