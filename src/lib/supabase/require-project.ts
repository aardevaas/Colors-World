import 'server-only';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from './server-client';
import { CURRENT_PROJECT_COOKIE, resolveCurrentProjectId } from './current-project';

/**
 * The signed-in user and the project this request acts on, in one call.
 *
 * Every server action and every project-scoped page did the same two steps —
 * establish the user, then `resolveDefaultProjectId(userId)` — across five
 * files and eleven call sites. Two steps repeated eleven times is eleven
 * chances to do only the first, and "the earliest project you own" was never a
 * choice anyone made; it was the absence of one.
 *
 * Collapsing them here means the membership check that makes the project
 * cookie safe cannot be skipped by adding a twelfth caller, because there is
 * no longer a step to forget.
 */

export interface RequestProject {
  readonly userId: string;
  readonly projectId: string;
  readonly supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
}

/**
 * The current project for a user a caller has ALREADY established.
 *
 * Pages redirect an anonymous visitor to /login rather than throwing, so they
 * do their own auth and only need the second half. Same cookie, same
 * membership check — the untrusted value never reaches a query unverified.
 */
export async function currentProjectId(
  userId: string,
  supabase?: Awaited<ReturnType<typeof createServerSupabaseClient>>
): Promise<string> {
  const jar = await cookies();
  return resolveCurrentProjectId(userId, jar.get(CURRENT_PROJECT_COOKIE)?.value, supabase);
}

/**
 * Resolve the current user and project, or throw.
 *
 * `message` is what an unauthenticated caller sees, so each surface can say
 * something true about what it was trying to do rather than sharing one
 * generic sentence.
 */
export async function requireProject(message?: string): Promise<RequestProject> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) {
    throw new Error(message ?? 'You must be signed in to do that.');
  }

  // Untrusted: the cookie is whatever the browser sent. `resolveCurrentProjectId`
  // verifies membership before it hands the id back, and falls back to this
  // user's own project when it cannot.
  const jar = await cookies();
  const requested = jar.get(CURRENT_PROJECT_COOKIE)?.value;

  const projectId = await resolveCurrentProjectId(user.id, requested, supabase);
  return { userId: user.id, projectId, supabase };
}
