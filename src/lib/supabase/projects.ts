import 'server-only';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './client';

export interface ProjectRecord {
  readonly id: string;
  readonly name: string;
  readonly ownerId: string;
  readonly createdAt: string;
}

interface ProjectRow {
  readonly id: string;
  readonly name: string;
  readonly owner_id: string;
  readonly created_at: string;
}

function mapProjectRow(row: ProjectRow): ProjectRecord {
  return { id: row.id, name: row.name, ownerId: row.owner_id, createdAt: row.created_at };
}

/**
 * Creates a project and immediately adds its owner as a member — an owner with
 * no membership row can't see their own project once RLS is on.
 *
 * The id is generated here rather than letting Postgres default it, and the
 * row is read back in a separate query *after* the membership row exists.
 * That ordering is load-bearing, not stylistic: `projects_select` is
 * `is_project_member(id)`, and an `insert(...).select()` compiles to
 * `INSERT ... RETURNING`, whose returned row is itself checked against the
 * SELECT policy. At that instant the caller is not yet a member of the project
 * they are creating, so the RETURNING fails and PostgREST surfaces it as
 * `new row violates row-level security policy` — making a successful insert
 * look like a rejected one.
 *
 * This never showed up before because the only project in existence was
 * created by enable-rls.sql's bootstrap running as the service role, which
 * bypasses RLS entirely. It surfaced the moment a real anonymous visitor tried
 * to self-provision on /studio.
 */
export async function createProject(
  name: string,
  ownerId: string,
  client?: SupabaseClient
): Promise<ProjectRecord> {
  const supabase = client ?? getSupabaseClient();
  const id = randomUUID();

  const { error } = await supabase.from('projects').insert({ id, name, owner_id: ownerId });
  if (error) throw new Error(`Failed to create project: ${error.message}`);

  const { error: memberError } = await supabase
    .from('project_members')
    .insert({ project_id: id, user_id: ownerId, role: 'owner' });
  if (memberError) {
    throw new Error(`Failed to add project owner as a member: ${memberError.message}`);
  }

  // Only now is the caller a member, so this select can pass its own policy.
  const { data, error: readError } = await supabase
    .from('projects')
    .select()
    .eq('id', id)
    .single<ProjectRow>();
  if (readError) throw new Error(`Failed to read back created project: ${readError.message}`);

  return mapProjectRow(data);
}

/**
 * The earliest project this user owns — a stand-in for "current project"
 * until a real project switcher exists (roadmap phase 4). Ownership only,
 * not shared membership: this is for resolving where a *new* palette from
 * Scale Lab should land, not for listing everything the user can see.
 */
export async function getDefaultProjectId(
  userId: string,
  client?: SupabaseClient
): Promise<string | null> {
  const supabase = client ?? getSupabaseClient();
  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .returns<{ id: string }[]>();

  if (error) throw new Error(`Failed to resolve default project: ${error.message}`);
  return data[0]?.id ?? null;
}

/**
 * The project a signed-in user's stuff lands in when there's no explicit
 * project switcher yet (roadmap phase 4 proper) — self-provisions a
 * "Personal" project the very first time this runs for someone. Both the
 * Studio Wall page and the Scale Lab "save as palette" flow call this so
 * neither can silently diverge on what "your project" means.
 */
export async function resolveDefaultProjectId(
  userId: string,
  client?: SupabaseClient
): Promise<string> {
  const existing = await getDefaultProjectId(userId, client);
  if (existing !== null) return existing;
  const project = await createProject('Personal', userId, client);
  return project.id;
}
