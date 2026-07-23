import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client, authenticated with the service-role key.
 *
 * This bypasses Row Level Security entirely — every table's RLS policies are
 * `auth.uid()`-scoped (see enable-rls.sql), and this client has no
 * `auth.uid()` at all, so it reads and writes as if every policy said `true`.
 * The `server-only` import makes the bundler throw at build time if this
 * file is ever pulled into a Client Component, but that only stops the most
 * obvious misuse — nothing stops a Server Component or Server Action from
 * importing this and quietly skipping RLS for a real user's request.
 *
 * There are exactly two sanctioned reasons to reach for this instead of the
 * per-request client (createServerSupabaseClient / server-client.ts):
 *   1. Ingestion/maintenance scripts (scripts/*.mjs, scripts/*.ts) — no
 *      request, no user, nothing to scope RLS against.
 *   2. src/lib/supabase/sharing.ts's resolveShareToken(), called only from
 *      the public /share/[token] route — an anonymous visitor has no
 *      auth.uid() either, so the application code (not RLS) is the
 *      authorization boundary there, and it's narrowly scoped: it looks up
 *      one project_id from a validated token and nothing else.
 * Anywhere else, if you're holding a real user's session, use the
 * per-request client so RLS actually applies to what you do with it.
 */
let cached: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (cached !== null) return cached;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url === undefined || serviceRoleKey === undefined) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example ' +
        'to .env.local and fill in your project credentials (Project Settings ' +
        '→ API in the Supabase dashboard).'
    );
  }

  // SUPABASE_URL must be the bare project origin — the client library appends
  // /rest/v1 itself. Pasting the REST endpoint URL (e.g. from a curl example
  // elsewhere in the dashboard) doubles that path and Postgrest fails with an
  // opaque PGRST125 "Invalid path" error on every request. Worth catching
  // here with an actionable message, since this is an easy paste to repeat.
  const pathname = new URL(url).pathname;
  if (pathname !== '' && pathname !== '/') {
    throw new Error(
      `SUPABASE_URL should be just the project origin (e.g. https://xxxx.supabase.co), ` +
        `with no path — got a URL containing "${pathname}". Use the "Project URL" field ` +
        `from Project Settings → API, not a REST endpoint URL.`
    );
  }

  cached = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
  return cached;
}
