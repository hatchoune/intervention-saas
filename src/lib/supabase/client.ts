import { createBrowserClient } from '@supabase/ssr';

import { requireSupabaseConfig } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Browser-side Supabase client (publishable/anon key).
 *
 * Row Level Security is the security boundary: the anon key can only ever read
 * or write what the signed-in user's policies allow.
 */
export function createSupabaseBrowserClient() {
  const { url, anonKey } = requireSupabaseConfig();

  return createBrowserClient<Database>(url, anonKey);
}
