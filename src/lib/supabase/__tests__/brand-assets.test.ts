import { describe, expect, test } from 'vitest';
import { createBrandAsset, deleteBrandAsset, listBrandAssets } from '../brand-assets';
import { createFakeSupabaseClient } from './fake-client';

const PROJECT_ID = 'project-1';
const USER_ID = 'user-1';

describe('createBrandAsset', () => {
  test('creates a brand-new asset at version 1 with a fresh group', async () => {
    const client = createFakeSupabaseClient();
    const asset = await createBrandAsset(
      { projectId: PROJECT_ID, name: 'Wordmark', kind: 'logo', storagePath: 'p/1', createdBy: USER_ID },
      client
    );

    expect(asset.version).toBe(1);
    expect(asset.name).toBe('Wordmark');
    expect(asset.kind).toBe('logo');
    expect(asset.groupId).toBeDefined();
  });

  test('adding a version to an existing group increments version and keeps the group id', async () => {
    const client = createFakeSupabaseClient();
    const first = await createBrandAsset(
      { projectId: PROJECT_ID, name: 'Wordmark', kind: 'logo', storagePath: 'p/1', createdBy: USER_ID },
      client
    );
    const second = await createBrandAsset(
      {
        projectId: PROJECT_ID,
        name: 'Wordmark',
        kind: 'logo',
        storagePath: 'p/2',
        createdBy: USER_ID,
        groupId: first.groupId,
      },
      client
    );

    expect(second.groupId).toBe(first.groupId);
    expect(second.version).toBe(2);
  });

  test('two independent uploads (no groupId) get different groups', async () => {
    const client = createFakeSupabaseClient();
    const a = await createBrandAsset(
      { projectId: PROJECT_ID, name: 'Logo A', kind: 'logo', storagePath: 'p/a', createdBy: USER_ID },
      client
    );
    const b = await createBrandAsset(
      { projectId: PROJECT_ID, name: 'Logo B', kind: 'mark', storagePath: 'p/b', createdBy: USER_ID },
      client
    );
    expect(a.groupId).not.toBe(b.groupId);
  });
});

describe('listBrandAssets', () => {
  test('only returns assets for the given project', async () => {
    const client = createFakeSupabaseClient();
    await createBrandAsset(
      { projectId: PROJECT_ID, name: 'Mine', kind: 'logo', storagePath: 'p/1', createdBy: USER_ID },
      client
    );
    await createBrandAsset(
      { projectId: 'other-project', name: 'Not mine', kind: 'logo', storagePath: 'p/2', createdBy: USER_ID },
      client
    );

    const assets = await listBrandAssets(PROJECT_ID, client);
    expect(assets).toHaveLength(1);
    expect(assets[0]?.name).toBe('Mine');
  });
});

describe('deleteBrandAsset', () => {
  test('removes just the one version, not the whole group', async () => {
    const client = createFakeSupabaseClient();
    const first = await createBrandAsset(
      { projectId: PROJECT_ID, name: 'Wordmark', kind: 'logo', storagePath: 'p/1', createdBy: USER_ID },
      client
    );
    const second = await createBrandAsset(
      {
        projectId: PROJECT_ID,
        name: 'Wordmark',
        kind: 'logo',
        storagePath: 'p/2',
        createdBy: USER_ID,
        groupId: first.groupId,
      },
      client
    );

    await deleteBrandAsset(first.id, client);
    const remaining = await listBrandAssets(PROJECT_ID, client);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe(second.id);
  });
});
