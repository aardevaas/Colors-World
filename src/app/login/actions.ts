'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server-client';

export interface SignInState {
  readonly status: 'idle' | 'sent' | 'error';
  readonly message: string;
}

const MIN_PASSWORD_LENGTH = 8;

async function resolveOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get('host') ?? 'localhost:3000';
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

/**
 * Magic-link — no password, but depends on Supabase actually being able to
 * send mail (custom SMTP, or its own low-volume default sender). Kept as an
 * option for whoever prefers it; password and OAuth below don't share that
 * dependency at all, so they keep working even if mail delivery is down or
 * rate-limited.
 */
export async function signInWithEmail(
  _prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim();
  if (email === '') {
    return { status: 'error', message: 'Enter an email address.' };
  }

  const origin = await resolveOrigin();
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

/**
 * One entry point for the password form — a hidden `mode` field says
 * whether this is a sign-up or a sign-in, so the page only needs one
 * useActionState hook regardless of which tab is showing.
 */
export async function passwordAuthAction(
  _prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  const mode = String(formData.get('mode') ?? 'signin');
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (email === '' || password === '') {
    return { status: 'error', message: 'Enter both an email and a password.' };
  }
  if (mode === 'signup' && password.length < MIN_PASSWORD_LENGTH) {
    return {
      status: 'error',
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  const supabase = await createServerSupabaseClient();

  if (mode === 'signup') {
    const origin = await resolveOrigin();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });
    if (error !== null) {
      return { status: 'error', message: error.message };
    }
    // If "Confirm email" is off in Supabase's Auth settings, a session comes
    // back immediately — no mail involved at all. If it's on, there's no
    // session yet and Supabase has already queued a confirmation email.
    if (data.session !== null) {
      redirect('/');
    }
    return { status: 'sent', message: `Check ${email} to confirm your account.` };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error !== null) {
    return { status: 'error', message: error.message };
  }
  redirect('/');
}

export type OAuthProvider = 'google' | 'github';

/** Identity comes from the provider, not an email round-trip — this never touches mail delivery. */
export async function signInWithOAuthProvider(provider: OAuthProvider): Promise<void> {
  const origin = await resolveOrigin();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error !== null || data.url === null) {
    redirect('/login?error=oauth');
  }
  redirect(data.url);
}
