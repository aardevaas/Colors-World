'use server';

import { headers } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase/server-client';

export interface SignInState {
  readonly status: 'idle' | 'sent' | 'error';
  readonly message: string;
}

/**
 * Magic-link only — no passwords. This is a ~10-person business-and-family
 * group; a password is one more thing for a family member to forget, and a
 * link they already have to click in their email is strictly less friction.
 */
export async function signInWithEmail(
  _prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim();
  if (email === '') {
    return { status: 'error', message: 'Enter an email address.' };
  }

  const headerList = await headers();
  const host = headerList.get('host') ?? 'localhost:3000';
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  const origin = `${protocol}://${host}`;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error !== null) {
    return { status: 'error', message: error.message };
  }
  return { status: 'sent', message: `Check ${email} for a sign-in link.` };
}
