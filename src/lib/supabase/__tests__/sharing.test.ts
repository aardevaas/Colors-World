import { describe, expect, test } from 'vitest';
import {
  createShareLink,
  getActiveShareLink,
  resolveShareToken,
  revokeShareLink,
} from '../sharing';
import { createFakeSupabaseClient } from './fake-client';

const PROJECT_ID = 'project-1';
const USER_ID = 'user-1';

describe('createShareLink', () => {
  test('creates a share with a long random token', async () => {
    const client = createFakeSupabaseClient();
    const share = await createShareLink(PROJECT_ID, USER_ID, client);

    expect(share.projectId).toBe(PROJECT_ID);
    expect(share.createdBy).toBe(USER_ID);
    expect(share.revokedAt).toBeNull();
    expect(share.token).toMatch(/^[0-9a-f]{48}$/);
  });

  test('two links for the same project get different tokens', async () => {
    const client = createFakeSupabaseClient();
    const a = await createShareLink(PROJECT_ID, USER_ID, client);
    const b = await createShareLink(PROJECT_ID, USER_ID, client);
    expect(a.token).not.toBe(b.token);
  });
});

describe('getActiveShareLink', () => {
  test('returns null when no share exists yet', async () => {
    const client = createFakeSupabaseClient();
    expect(await getActiveShareLink(PROJECT_ID, client)).toBeNull();
  });

  test('returns the share once one is created', async () => {
    const client = createFakeSupabaseClient();
    const created = await createShareLink(PROJECT_ID, USER_ID, client);
    const active = await getActiveShareLink(PROJECT_ID, client);
    expect(active?.id).toBe(created.id);
  });

  test('does not return a revoked share', async () => {
    const client = createFakeSupabaseClient();
    const created = await createShareLink(PROJECT_ID, USER_ID, client);
    await revokeShareLink(created.id, client);
    expect(await getActiveShareLink(PROJECT_ID, client)).toBeNull();
  });
});

describe('resolveShareToken', () => {
  test('resolves a live token to its project', async () => {
    const client = createFakeSupabaseClient();
    const share = await createShareLink(PROJECT_ID, USER_ID, client);
    const resolved = await resolveShareToken(share.token, client);
    expect(resolved).toEqual({ projectId: PROJECT_ID });
  });

  test('returns null for an unknown token', async () => {
    const client = createFakeSupabaseClient();
    expect(await resolveShareToken('not-a-real-token', client)).toBeNull();
  });

  test('returns null for a revoked token — the whole point of revoking', async () => {
    const client = createFakeSupabaseClient();
    const share = await createShareLink(PROJECT_ID, USER_ID, client);
    await revokeShareLink(share.id, client);
    expect(await resolveShareToken(share.token, client)).toBeNull();
  });
});
