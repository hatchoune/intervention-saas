import 'server-only';

import { createClient } from '@supabase/supabase-js';

import { requireServiceRoleKey, requireSupabaseConfig } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Service-role client. It bypasses Row Level Security, therefore:
 *
 *  - `server-only` makes the build fail if it is ever imported from a client
 *    component;
 *  - it must never be used to answer a normal user request.
 *
 * Legitimate uses: maintenance jobs (expiring invitations, overdue invoice
 * sweep) and account provisioning for invited users.
 */
export function createSupabaseAdminClient() {
  const { url } = requireSupabaseConfig();

  return createClient<Database>(url, requireServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
