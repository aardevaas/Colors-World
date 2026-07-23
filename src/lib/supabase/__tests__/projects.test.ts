import { describe, expect, test } from 'vitest';
import { createProject, getDefaultProjectId } from '../projects';
import { createFakeSupabaseClient } from './fake-client';

const OWNER_ID = 'user-1';

describe('createProject', () => {
  test('creates the project and adds its owner as a member in one call', async () => {
    const client = createFakeSupabaseClient();
    const project = await createProject('Personal', OWNER_ID, client);

    expect(project.name).toBe('Personal');
    expect(project.ownerId).toBe(OWNER_ID);
    expect(project.id).toBeTruthy();

    const members = await client
      .from('project_members')
      .select()
      .eq('project_id', project.id)
      .returns<{ user_id: string; role: string }[]>();
    expect(members.data).toHaveLength(1);
    expect(members.data?.[0]).toMatchObject({ user_id: OWNER_ID, role: 'owner' });
  });
});

describe('getDefaultProjectId', () => {
  test('returns null when the user owns no project yet', async () => {
    const client = createFakeSupabaseClient();
    expect(await getDefaultProjectId(OWNER_ID, client)).toBeNull();
  });

  test('returns the earliest project this user owns', async () => {
    const client = createFakeSupabaseClient();
    const first = await createProject('Personal', OWNER_ID, client);
    await createProject('Second Project', OWNER_ID, client);

    expect(await getDefaultProjectId(OWNER_ID, client)).toBe(first.id);
  });

  test('ignores projects owned by other users', async () => {
    const client = createFakeSupabaseClient();
    await createProject('Someone Else', 'user-2', client);

    expect(await getDefaultProjectId(OWNER_ID, client)).toBeNull();
  });
});
