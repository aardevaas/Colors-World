import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refreshes the Supabase auth cookie on every request. Server Components
 * can't write cookies (see server-client.ts's setAll try/catch), so without
 * this a session sitting near expiry would silently start failing instead
 * of quietly renewing — this is what makes renewal actually happen.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url === undefined || anonKey === undefined || anonKey === '') {
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Touching getUser() is what triggers the refresh — a plain getSession()
  // read wouldn't validate or renew an expiring token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No session at all (first visit, or a fully signed-out browser) — give
  // every visitor a real session immediately so browsing and collecting
  // never needs a signup wall. signInAnonymously() writes its cookies
  // through the same setAll above, so this is the only layer that can do it
  // (Server Components can't persist cookies at all).
  if (user === null) {
    await supabase.auth.signInAnonymously();
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
