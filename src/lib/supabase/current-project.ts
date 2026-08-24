import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './client';
import { createProject, getDefaultProjectId, type ProjectRecord } from './projects';

/**
 * Which project this request acts on.
 *
 * `resolveDefaultProjectId` answered "the earliest project you own" and every
 * one of its eleven call sites took that as "your project" — which is a
 * single-project product wearing a multi-project schema. The tables have
 * supported many projects per user since they were written; nothing ever
 * chose between them.
 *
 * ## The cookie is an input, not an authority
 *
 * The current project is carried in a cookie, because a server action has no
 * URL to read and threading a project id through every form in the app is
 * plumbing that only has to be forgotten once. A cookie is user-controlled:
 * anyone can put anyone else's project id in it.
 *
 * **So membership is verified here, on every resolution, before the id is
 * returned to anything that writes.** RLS would refuse the write anyway — that
 * is the real boundary and it stays the real boundary — but a policy failure
 * surfaces as an opaque Postgres error somewhere deep in an action, and a
 * check here turns an attack into a no-op and a stale cookie into a fallback.
 *
 * An unverifiable request falls back rather than throwing. Losing access to a
 * project is ordinary — it was deleted, membership was revoked — and it must
 * not lock someone out of their own work.
 */

/**
 * The cookie the project switcher writes.
 *
 * Prefixed rather than bare `project`, because this is not the only thing that
 * will ever want that word in a cookie jar shared across localhost ports.
 */
export const CURRENT_PROJECT_COOKIE = 'cw_project';

interface MemberRow {
  readonly project_id: string;
}

interface ProjectRow {
  readonly id: string;
  readonly name: string;
  readonly owner_id: string;
  readonly created_at: string;
}

/** Whether this user is a member of this project. The security check. */
export async function isMemberOf(
  projectId: string,
  userId: string,
  client?: SupabaseClient
): Promise<boolean> {
  const supabase = client ?? getSupabaseClient();
  const { data, error } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .returns<MemberRow[]>();

  // A failed lookup is NOT membership. Returning true on error would turn a
  // transient database problem into an authorisation bypass.
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

/**
 * The project id to use, given what the request asked for.
 *
 * `requested` is whatever the cookie held — untrusted, possibly stale,
 * possibly someone else's. It is used only if this user is a member of it.
 */
export async function resolveCurrentProjectId(
  userId: string,
  requested: string | undefined,
  client?: SupabaseClient
): Promise<string> {
  const wanted = requested?.trim();
  if (wanted !== undefined && wanted !== '' && (await isMemberOf(wanted, userId, client))) {
    return wanted;
  }

  const own = await getDefaultProjectId(userId, client);
  if (own !== null) return own;

  const created = await createProject('Personal', userId, client);
  return created.id;
}

/**
 * Every project this user can see, oldest first — what the switcher lists.
 *
 * Membership, not ownership. `getDefaultProjectId` deliberately asks only
 * about ownership because it is choosing where a NEW thing lands; this is the
 * other question, and a project someone was added to belongs in the list.
 */
export async function listProjectsForUser(
  userId: string,
  client?: SupabaseClient
): Promise<readonly ProjectRecord[]> {
  const supabase = client ?? getSupabaseClient();

  const { data: memberships, error: memberError } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('user_id', userId)
    .returns<MemberRow[]>();
  if (memberError) throw new Error(`Failed to list memberships: ${memberError.message}`);

  const ids = (memberships ?? []).map((m) => m.project_id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('projects')
    .select()
    .in('id', ids)
    .order('created_at', { ascending: true })
    .returns<ProjectRow[]>();
  if (error) throw new Error(`Failed to list projects: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    createdAt: row.created_at,
  }));
}
