'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase/server-client';
import { createProject } from '@/lib/supabase/projects';
import { CURRENT_PROJECT_COOKIE, isMemberOf } from '@/lib/supabase/current-project';

/** A year. The switcher is a preference, not a session. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) throw new Error('You must be signed in to switch project.');
  return { user, supabase };
}

/**
 * Store the chosen project for this browser.
 *
 * `httpOnly` even though nothing client-side reads it: it is one less thing an
 * injected script can rewrite, and the day something does need to read it, the
 * right answer is a server component passing it down rather than opening the
 * cookie.
 *
 * Not `secure` unconditionally — that would silently fail on http://localhost
 * and make the switcher look broken in development only.
 */
async function pinProject(projectId: string): Promise<void> {
  const jar = await cookies();
  jar.set(CURRENT_PROJECT_COOKIE, projectId, {
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  });
  // Every project-scoped surface reads this, and none of them can know it
  // changed.
  revalidatePath('/', 'layout');
}

/**
 * Point this browser at a different project.
 *
 * Membership is checked HERE as well as in `resolveCurrentProjectId`, and the
 * duplication is deliberate. The resolver's check makes a hostile cookie
 * harmless; this one stops a hostile cookie being written at all, so an
 * attempt fails visibly at the moment it is made rather than silently falling
 * back on every request afterwards. Refusing to store an unusable value also
 * means a legitimate switch can never be quietly lost.
 */
export async function switchProjectAction(formData: FormData): Promise<void> {
  const { user, supabase } = await requireUser();

  const projectId = formData.get('projectId');
  if (typeof projectId !== 'string' || projectId === '') {
    throw new Error('No project was chosen.');
  }
  if (!(await isMemberOf(projectId, user.id, supabase))) {
    throw new Error('That project does not exist, or you are not a member of it.');
  }

  await pinProject(projectId);
}

/** Create a project and switch to it, which is the only reason to create one. */
export async function createProjectAction(formData: FormData): Promise<void> {
  const { user, supabase } = await requireUser();

  const raw = formData.get('name');
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (name === '') throw new Error('A project needs a name.');
  if (name.length > 80) throw new Error('That name is too long.');

  const project = await createProject(name, user.id, supabase);
  await pinProject(project.id);
}
