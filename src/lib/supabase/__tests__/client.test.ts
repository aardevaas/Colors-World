import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * Only the env-var validation is unit-testable without a live Supabase
 * project. The actual `createClient` call is exercised implicitly the first
 * time real persistence code runs against real credentials — there is
 * nothing meaningful to assert about it in isolation.
 *
 * The module under test caches its client in module-level state, so each
 * test must get a fresh module instance via `vi.resetModules()` — otherwise
 * whichever test runs first "wins" the cache for the rest of the file.
 */
describe('getSupabaseClient', () => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  });

  test('throws a clear error when both env vars are missing', async () => {
    const { getSupabaseClient } = await import('../client');
    expect(() => getSupabaseClient()).toThrow(/SUPABASE_URL/);
  });

  test('throws when only the service-role key is missing', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    const { getSupabaseClient } = await import('../client');
    expect(() => getSupabaseClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  test('constructs a client when both env vars are present', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    const { getSupabaseClient } = await import('../client');
    expect(() => getSupabaseClient()).not.toThrow();
  });

  test('rejects a URL that includes the REST endpoint path', async () => {
    // The exact misconfiguration this project hit: pasting the REST endpoint
    // URL instead of the bare project origin doubles the /rest/v1 path and
    // Postgrest fails every request with an opaque PGRST125 error. Catching
    // it here turns that into an actionable message instead.
    process.env.SUPABASE_URL = 'https://example.supabase.co/rest/v1/';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    const { getSupabaseClient } = await import('../client');
    expect(() => getSupabaseClient()).toThrow(/project origin/);
  });

  test('accepts a bare origin with no trailing slash', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    const { getSupabaseClient } = await import('../client');
    expect(() => getSupabaseClient()).not.toThrow();
  });
});
