import { describe, expect, test } from 'vitest';
import {
  commitVersionToBranch,
  forkBranch,
  getBranchSnapshot,
  initializePalette,
} from '../branch-workflow';
import { getVersion } from '../palettes';
import { createFakeSupabaseClient } from './fake-client';

describe('initializePalette', () => {
  test('creates a palette, a root version with no parents, and a "main" branch', async () => {
    const client = createFakeSupabaseClient();
    const { palette, version, branch } = await initializePalette(
      'brand',
      { 'brand-5': '#3b82f6' },
      undefined,
      client
    );

    expect(palette.name).toBe('brand');
    expect(version.parentIds).toEqual([]);
    expect(version.snapshot).toEqual({ 'brand-5': '#3b82f6' });
    expect(branch.name).toBe('main');
    expect(branch.headVersionId).toBe(version.id);
  });

  test('honours a custom branch name', async () => {
    const client = createFakeSupabaseClient();
    const { branch } = await initializePalette(
      'brand',
      {},
      { branchName: 'trunk' },
      client
    );
    expect(branch.name).toBe('trunk');
  });
});

describe('forkBranch', () => {
  test('creates a new branch pointing at the source branch\'s current head', async () => {
    const client = createFakeSupabaseClient();
    const { palette, version } = await initializePalette('brand', { x: '#000000' }, undefined, client);

    const fork = await forkBranch(palette.id, 'main', 'experiment', client);
    expect(fork.name).toBe('experiment');
    expect(fork.headVersionId).toBe(version.id);
  });

  test('throws when the source branch does not exist', async () => {
    const client = createFakeSupabaseClient();
    const { palette } = await initializePalette('brand', {}, undefined, client);
    await expect(forkBranch(palette.id, 'nonexistent', 'x', client)).rejects.toThrow(
      /does not exist/
    );
  });

  test('throws when the target branch name is already taken', async () => {
    const client = createFakeSupabaseClient();
    const { palette } = await initializePalette('brand', {}, undefined, client);
    await expect(forkBranch(palette.id, 'main', 'main', client)).rejects.toThrow(
      /already exists/
    );
  });
});

describe('commitVersionToBranch', () => {
  test('writes a single-parent version and fast-forwards the branch', async () => {
    const client = createFakeSupabaseClient();
    const { palette, version: root } = await initializePalette(
      'brand',
      { 'brand-5': '#3b82f6' },
      undefined,
      client
    );

    const { version, branch } = await commitVersionToBranch(
      palette.id,
      'main',
      { 'brand-5': '#2563eb' },
      'nudge warmer',
      client
    );

    expect(version.parentIds).toEqual([root.id]);
    expect(version.snapshot).toEqual({ 'brand-5': '#2563eb' });
    expect(version.message).toBe('nudge warmer');
    expect(branch.headVersionId).toBe(version.id);
  });

  test('a fork left uncommitted still points at the pre-fork history, unaffected by the parent branch moving on', async () => {
    const client = createFakeSupabaseClient();
    const { palette, version: root } = await initializePalette(
      'brand',
      { x: '#000000' },
      undefined,
      client
    );
    const fork = await forkBranch(palette.id, 'main', 'experiment', client);

    await commitVersionToBranch(palette.id, 'main', { x: '#111111' }, undefined, client);

    // "experiment" was never touched — real branch independence, not a shared reference.
    const forkSnapshot = await getBranchSnapshot(palette.id, 'experiment', client);
    expect(forkSnapshot?.branch.headVersionId).toBe(fork.headVersionId);
    expect(forkSnapshot?.snapshot).toEqual({ x: '#000000' });
    expect(fork.headVersionId).toBe(root.id);
  });

  test('throws when the branch does not exist', async () => {
    const client = createFakeSupabaseClient();
    const { palette } = await initializePalette('brand', {}, undefined, client);
    await expect(
      commitVersionToBranch(palette.id, 'nonexistent', {}, undefined, client)
    ).rejects.toThrow(/does not exist/);
  });
});

describe('getBranchSnapshot', () => {
  test('resolves a branch to its head version\'s snapshot', async () => {
    const client = createFakeSupabaseClient();
    const { palette } = await initializePalette('brand', { x: '#123456' }, undefined, client);

    const result = await getBranchSnapshot(palette.id, 'main', client);
    expect(result?.snapshot).toEqual({ x: '#123456' });
  });

  test('returns null when the branch does not exist', async () => {
    const client = createFakeSupabaseClient();
    const { palette } = await initializePalette('brand', {}, undefined, client);
    expect(await getBranchSnapshot(palette.id, 'nonexistent', client)).toBeNull();
  });

  test('reflects the latest commit after one is made', async () => {
    const client = createFakeSupabaseClient();
    const { palette } = await initializePalette('brand', { x: '#000000' }, undefined, client);
    await commitVersionToBranch(palette.id, 'main', { x: '#ffffff' }, undefined, client);

    const result = await getBranchSnapshot(palette.id, 'main', client);
    expect(result?.snapshot).toEqual({ x: '#ffffff' });
  });
});

describe('cross-check against palettes repository', () => {
  test('commitVersionToBranch\'s returned version really is persisted', async () => {
    const client = createFakeSupabaseClient();
    const { palette } = await initializePalette('brand', { x: '#000000' }, undefined, client);
    const { version } = await commitVersionToBranch(palette.id, 'main', { x: '#ffffff' }, undefined, client);
    expect(await getVersion(version.id, client)).toEqual(version);
  });
});
