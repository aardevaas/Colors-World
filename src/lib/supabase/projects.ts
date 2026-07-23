import 'server-only';
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

/** Creates a project and immediately adds its owner as a member — an owner with no membership row can't see their own project once RLS is on. */
export async function createProject(
  name: string,
  ownerId: string,
  client?: SupabaseClient
): Promise<ProjectRecord> {
  const supabase = client ?? getSupabaseClient();
  const { data, error } = await supabase
    .from('projects')
    .insert({ name, owner_id: ownerId })
    .select()
    .single<ProjectRow>();
  if (error) throw new Error(`Failed to create project: ${error.message}`);

  const { error: memberError } = await supabase
    .from('project_members')
    .insert({ project_id: data.id, user_id: ownerId, role: 'owner' });
  if (memberError) {
    throw new Error(`Failed to add project owner as a member: ${memberError.message}`);
  }

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
