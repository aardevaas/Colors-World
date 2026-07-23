import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Per-request, cookie-authenticated Supabase client — the anon key plus
 * whichever user's session cookie came in with this request. This is what
 * every Server Component and Server Action should use going forward:
 * unlike the service-role client in client.ts, queries through this one
 * are the identity Row Level Security actually checks against.
 *
 * The service-role client still exists, but only for scripts/ (ingestion)
 * — it bypasses RLS entirely, which is exactly wrong for app traffic now
 * that this is multi-user.
 */
export async function createServerSupabaseClient(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url === undefined || anonKey === undefined || anonKey === '') {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Copy the anon/public key from Project Settings → API in the Supabase ' +
        'dashboard into .env.local — this one is safe to expose to the browser, ' +
        'unlike the service-role key.'
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies can't be written.
          // Harmless as long as middleware.ts is refreshing the session on
          // every request, which it is — see src/middleware.ts.
        }
      },
    },
  });
}
