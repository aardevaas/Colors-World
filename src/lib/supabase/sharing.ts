import 'server-only';
import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './client';

export interface ShareLinkRecord {
  readonly id: string;
  readonly projectId: string;
  readonly token: string;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly revokedAt: string | null;
}

interface ShareLinkRow {
  readonly id: string;
  readonly project_id: string;
  readonly token: string;
  readonly created_by: string;
  readonly created_at: string;
  readonly revoked_at: string | null;
}

function mapShareLinkRow(row: ShareLinkRow): ShareLinkRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    token: row.token,
    createdBy: row.created_by,
    createdAt: row.created_at,
    revokedAt: row.revoked_at ?? null,
  };
}

/** 192 bits — enough that guessing a live token is not a realistic attack. */
const TOKEN_BYTES = 24;

/**
 * `client` is required (not optional-with-service-role-fallback like this
 * project's usual repository convention) for these three functions
 * specifically: they must only ever run with the per-request, RLS-scoped
 * client, since they create/read/revoke a share link on behalf of a real
 * signed-in member. Falling back to the service-role client here would
 * silently bypass is_project_member() the moment a caller forgot to pass
 * one — a compile error on a missing argument is far safer than that.
 * (resolveShareToken below is the one function in this file that legitimately
 * needs the service-role client, since an anonymous visitor has no auth.uid().)
 */
export async function getActiveShareLink(
  projectId: string,
  client: SupabaseClient
): Promise<ShareLinkRecord | null> {
  const { data, error } = await client
    .from('board_shares')
    .select()
    .eq('project_id', projectId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<ShareLinkRow>();

  if (error) throw new Error(`Failed to look up share link: ${error.message}`);
  return data === null ? null : mapShareLinkRow(data);
}

export async function createShareLink(
  projectId: string,
  createdBy: string,
  client: SupabaseClient
): Promise<ShareLinkRecord> {
  const token = randomBytes(TOKEN_BYTES).toString('hex');

  const { data, error } = await client
    .from('board_shares')
    .insert({ project_id: projectId, token, created_by: createdBy })
    .select()
    .single<ShareLinkRow>();

  if (error) throw new Error(`Failed to create share link: ${error.message}`);
  return mapShareLinkRow(data);
}

export async function revokeShareLink(id: string, client: SupabaseClient): Promise<void> {
  const { error } = await client
    .from('board_shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(`Failed to revoke share link: ${error.message}`);
}

/**
 * Resolves a public share token to its project — the one place in this app
 * where an unauthenticated visitor is allowed to read project data. Must
 * only ever be called with the service-role client (see sharing.sql for why),
 * and the caller must scope every subsequent query to the returned
 * projectId — never trust any other project identifier from the request.
 */
export async function resolveShareToken(
  token: string,
  client?: SupabaseClient
): Promise<{ projectId: string } | null> {
  const supabase = client ?? getSupabaseClient();
  const { data, error } = await supabase
    .from('board_shares')
    .select('project_id')
    .eq('token', token)
    .is('revoked_at', null)
    .maybeSingle<{ project_id: string }>();

  if (error) throw new Error(`Failed to resolve share token: ${error.message}`);
  return data === null ? null : { projectId: data.project_id };
}
