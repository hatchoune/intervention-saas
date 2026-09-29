import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { requireSupabaseConfig } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Request-scoped Supabase client for Server Components, Server Actions and
 * Route Handlers. Authenticated as the current user, so RLS applies.
 */
export async function createSupabaseServerClient() {
  // The cookie store is read before the configuration check: `cookies()` is what
  // marks the surrounding route as dynamic, so a missing `.env.local` surfaces as
  // a readable error at request time instead of a pre-render crash at build time.
  const cookieStore = await cookies();
  const { url, anonKey } = requireSupabaseConfig();

  return createServerClient<Database>(url, anonKey, {
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
          // Server Components cannot write cookies. The middleware refreshes
          // the session instead, so this is safe to ignore.
        }
      },
    },
  });
}

export type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
