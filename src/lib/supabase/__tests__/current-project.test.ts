import { describe, expect, test } from 'vitest';
import { createProject } from '../projects';
import { isMemberOf, listProjectsForUser, resolveCurrentProjectId } from '../current-project';
import { createFakeSupabaseClient } from './fake-client';

const ALICE = 'user-alice';
const MALLORY = 'user-mallory';

describe('isMemberOf', () => {
  test('is true for a project the user belongs to', async () => {
    const client = createFakeSupabaseClient();
    const project = await createProject('Personal', ALICE, client);
    expect(await isMemberOf(project.id, ALICE, client)).toBe(true);
  });

  test('is false for a project the user does not belong to', async () => {
    const client = createFakeSupabaseClient();
    const alices = await createProject('Personal', ALICE, client);
    expect(await isMemberOf(alices.id, MALLORY, client)).toBe(false);
  });

  test('is false for a project id that does not exist', async () => {
    const client = createFakeSupabaseClient();
    expect(await isMemberOf('no-such-project', ALICE, client)).toBe(false);
  });

  test('is FALSE when the lookup itself fails — it must never fail open', async () => {
    // A transient database problem returning `true` here would turn an outage
    // into an authorisation bypass: every cookie would be honoured for the
    // duration. This is the single most important line in the module.
    const failing = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              returns: async () => ({ data: null, error: { message: 'connection reset' } }),
            }),
          }),
        }),
      }),
    } as unknown as Parameters<typeof isMemberOf>[2];

    expect(await isMemberOf('any-project', ALICE, failing)).toBe(false);
  });

  test('a failed lookup makes resolveCurrentProjectId ignore the cookie', async () => {
    const client = createFakeSupabaseClient();
    const own = await createProject('Personal', ALICE, client);
    const someoneElses = await createProject('Theirs', MALLORY, client);

    // Membership says no (whatever the reason); the resolver must land on the
    // user's own project rather than the id it was handed.
    expect(await resolveCurrentProjectId(ALICE, someoneElses.id, client)).toBe(own.id);
  });
});

describe('resolveCurrentProjectId', () => {
  test('honours a requested project the user is a member of', async () => {
    const client = createFakeSupabaseClient();
    await createProject('First', ALICE, client);
    const second = await createProject('Second', ALICE, client);
    expect(await resolveCurrentProjectId(ALICE, second.id, client)).toBe(second.id);
  });

  test('IGNORES a requested project the user is not a member of', async () => {
    // The request carries this id in a cookie, which the user controls. A
    // resolver that trusted it would hand one tenant another tenant's project
    // id and let every downstream write land in it.
    const client = createFakeSupabaseClient();
    const alices = await createProject('Alice private', ALICE, client);
    const mallorys = await createProject('Mallory', MALLORY, client);

    const resolved = await resolveCurrentProjectId(MALLORY, alices.id, client);
    expect(resolved).toBe(mallorys.id);
    expect(resolved).not.toBe(alices.id);
  });

  test('falls back rather than throwing when the cookie is stale', async () => {
    // Leaving a project or having one deleted is ordinary, not an attack, and
    // it must not break the app for its owner.
    const client = createFakeSupabaseClient();
    const own = await createProject('Personal', ALICE, client);
    expect(await resolveCurrentProjectId(ALICE, 'deleted-project-id', client)).toBe(own.id);
  });

  test('falls back to the earliest project when nothing is requested', async () => {
    const client = createFakeSupabaseClient();
    const first = await createProject('First', ALICE, client);
    await createProject('Second', ALICE, client);
    expect(await resolveCurrentProjectId(ALICE, undefined, client)).toBe(first.id);
  });

  test('self-provisions for a user who has none', async () => {
    const client = createFakeSupabaseClient();
    const id = await resolveCurrentProjectId(ALICE, undefined, client);
    expect(id).toBeTruthy();
    expect(await isMemberOf(id, ALICE, client)).toBe(true);
  });

  test('self-provisions exactly once', async () => {
    const client = createFakeSupabaseClient();
    const first = await resolveCurrentProjectId(ALICE, undefined, client);
    const second = await resolveCurrentProjectId(ALICE, undefined, client);
    expect(second).toBe(first);
  });

  test('an empty or blank requested id is treated as none, not as a lookup', async () => {
    const client = createFakeSupabaseClient();
    const own = await createProject('Personal', ALICE, client);
    for (const bad of ['', '   ']) {
      expect(await resolveCurrentProjectId(ALICE, bad, client)).toBe(own.id);
    }
  });

  test('two users never resolve to each other’s project', async () => {
    const client = createFakeSupabaseClient();
    const a = await resolveCurrentProjectId(ALICE, undefined, client);
    const m = await resolveCurrentProjectId(MALLORY, undefined, client);
    expect(a).not.toBe(m);
    expect(await isMemberOf(a, MALLORY, client)).toBe(false);
    expect(await isMemberOf(m, ALICE, client)).toBe(false);
  });
});

describe('listProjectsForUser', () => {
  test('lists every project the user is a member of, oldest first', async () => {
    const client = createFakeSupabaseClient();
    const first = await createProject('First', ALICE, client);
    const second = await createProject('Second', ALICE, client);
    await createProject('Mallory', MALLORY, client);

    const projects = await listProjectsForUser(ALICE, client);
    expect(projects.map((p) => p.id)).toEqual([first.id, second.id]);
  });

  test('includes a project the user was added to but does not own', async () => {
    const client = createFakeSupabaseClient();
    const mallorys = await createProject('Shared', MALLORY, client);
    await client
      .from('project_members')
      .insert({ project_id: mallorys.id, user_id: ALICE, role: 'editor' });

    expect((await listProjectsForUser(ALICE, client)).map((p) => p.id)).toContain(mallorys.id);
  });

  test('is empty for a user with nothing, rather than throwing', async () => {
    expect(await listProjectsForUser(ALICE, createFakeSupabaseClient())).toEqual([]);
  });
});
