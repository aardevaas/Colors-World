import { describe, expect, test } from 'vitest';
import {
  createBranch,
  createPalette,
  createVersion,
  getBranch,
  getPalette,
  getPaletteByName,
  getVersion,
  listBranches,
  listPalettes,
  listVersions,
  updateBranchHead,
} from '../palettes';
import { createFakeSupabaseClient } from './fake-client';

describe('palettes', () => {
  test('createPalette returns a mapped record with generated id and timestamps', async () => {
    const client = createFakeSupabaseClient();
    const record = await createPalette('brand', client);

    expect(record.name).toBe('brand');
    expect(record.id).toBeTruthy();
    expect(record.createdAt).toBeTruthy();
    expect(record.updatedAt).toBeTruthy();
  });

  test('getPalette finds an existing palette by id', async () => {
    const client = createFakeSupabaseClient();
    const created = await createPalette('brand', client);
    const found = await getPalette(created.id, client);
    expect(found).toEqual(created);
  });

  test('getPalette returns null for a missing id', async () => {
    const client = createFakeSupabaseClient();
    expect(await getPalette('does-not-exist', client)).toBeNull();
  });

  test('getPaletteByName finds a palette by its name', async () => {
    const client = createFakeSupabaseClient();
    const created = await createPalette('Demo Palette', client);
    expect(await getPaletteByName('Demo Palette', client)).toEqual(created);
  });

  test('getPaletteByName returns null when no palette has that name', async () => {
    const client = createFakeSupabaseClient();
    expect(await getPaletteByName('nonexistent', client)).toBeNull();
  });

  test('listPalettes returns every created palette', async () => {
    const client = createFakeSupabaseClient();
    await createPalette('brand', client);
    await createPalette('accent', client);
    const all = await listPalettes(client);
    expect(all.map((p) => p.name).sort()).toEqual(['accent', 'brand']);
  });
});

describe('versions', () => {
  test('createVersion maps parent_ids and snapshot correctly', async () => {
    const client = createFakeSupabaseClient();
    const palette = await createPalette('brand', client);

    const version = await createVersion(
      { paletteId: palette.id, parentIds: [], snapshot: { 'brand-5': '#3b82f6' } },
      client
    );

    expect(version.paletteId).toBe(palette.id);
    expect(version.parentIds).toEqual([]);
    expect(version.snapshot).toEqual({ 'brand-5': '#3b82f6' });
    expect(version.message).toBeNull();
    expect(version.builderSpecs).toBeNull();
  });

  test('createVersion stores and round-trips builderSpecs when supplied by /builder', async () => {
    const client = createFakeSupabaseClient();
    const palette = await createPalette('brand', client);
    const specs = [
      { name: 'primary', anchors: [{ step: 5, color: '#3b82f6' }], chromaIntensity: 0.8 },
    ];

    const version = await createVersion(
      {
        paletteId: palette.id,
        parentIds: [],
        snapshot: { 'primary-5': '#3b82f6' },
        builderSpecs: specs,
      },
      client
    );

    expect(version.builderSpecs).toEqual(specs);

    const reloaded = await getVersion(version.id, client);
    expect(reloaded?.builderSpecs).toEqual(specs);
  });

  test('createVersion records parent_ids for a merge commit', async () => {
    const client = createFakeSupabaseClient();
    const palette = await createPalette('brand', client);
    const a = await createVersion(
      { paletteId: palette.id, parentIds: [], snapshot: {} },
      client
    );
    const b = await createVersion(
      { paletteId: palette.id, parentIds: [], snapshot: {} },
      client
    );
    const merge = await createVersion(
      { paletteId: palette.id, parentIds: [a.id, b.id], snapshot: {}, message: 'merge' },
      client
    );

    expect(merge.parentIds).toEqual([a.id, b.id]);
    expect(merge.message).toBe('merge');
  });

  test('getVersion round-trips a created version', async () => {
    const client = createFakeSupabaseClient();
    const palette = await createPalette('brand', client);
    const created = await createVersion(
      { paletteId: palette.id, parentIds: [], snapshot: { x: '#000000' } },
      client
    );
    expect(await getVersion(created.id, client)).toEqual(created);
  });

  test('listVersions returns only versions for the requested palette, oldest first', async () => {
    const client = createFakeSupabaseClient();
    const brand = await createPalette('brand', client);
    const accent = await createPalette('accent', client);

    const v1 = await createVersion({ paletteId: brand.id, parentIds: [], snapshot: {} }, client);
    await createVersion({ paletteId: accent.id, parentIds: [], snapshot: {} }, client);
    const v2 = await createVersion(
      { paletteId: brand.id, parentIds: [v1.id], snapshot: {} },
      client
    );

    const versions = await listVersions(brand.id, client);
    expect(versions.map((v) => v.id)).toEqual([v1.id, v2.id]);
  });
});

describe('branches', () => {
  test('createBranch and getBranch round-trip', async () => {
    const client = createFakeSupabaseClient();
    const palette = await createPalette('brand', client);
    const version = await createVersion(
      { paletteId: palette.id, parentIds: [], snapshot: {} },
      client
    );

    const branch = await createBranch(
      { paletteId: palette.id, name: 'main', headVersionId: version.id },
      client
    );
    expect(branch.name).toBe('main');
    expect(branch.headVersionId).toBe(version.id);

    expect(await getBranch(palette.id, 'main', client)).toEqual(branch);
  });

  test('getBranch returns null when no branch has that name', async () => {
    const client = createFakeSupabaseClient();
    const palette = await createPalette('brand', client);
    expect(await getBranch(palette.id, 'nonexistent', client)).toBeNull();
  });

  test('listBranches scopes to the given palette', async () => {
    const client = createFakeSupabaseClient();
    const brand = await createPalette('brand', client);
    const accent = await createPalette('accent', client);
    const v1 = await createVersion({ paletteId: brand.id, parentIds: [], snapshot: {} }, client);
    const v2 = await createVersion({ paletteId: accent.id, parentIds: [], snapshot: {} }, client);

    await createBranch({ paletteId: brand.id, name: 'main', headVersionId: v1.id }, client);
    await createBranch({ paletteId: accent.id, name: 'main', headVersionId: v2.id }, client);

    const brandBranches = await listBranches(brand.id, client);
    expect(brandBranches).toHaveLength(1);
    expect(brandBranches[0]!.paletteId).toBe(brand.id);
  });

  test('updateBranchHead moves the pointer to a new version', async () => {
    const client = createFakeSupabaseClient();
    const palette = await createPalette('brand', client);
    const v1 = await createVersion({ paletteId: palette.id, parentIds: [], snapshot: {} }, client);
    const v2 = await createVersion(
      { paletteId: palette.id, parentIds: [v1.id], snapshot: {} },
      client
    );

    const branch = await createBranch(
      { paletteId: palette.id, name: 'main', headVersionId: v1.id },
      client
    );
    const updated = await updateBranchHead(branch.id, v2.id, client);

    expect(updated.headVersionId).toBe(v2.id);
    expect(await getBranch(palette.id, 'main', client)).toEqual(
      expect.objectContaining({ headVersionId: v2.id })
    );
  });
});
