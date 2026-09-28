/**
 * Environment access.
 *
 * `NEXT_PUBLIC_*` variables are read literally so that Next.js can inline them
 * into the browser bundle at build time. Everything else stays server-side.
 */

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || 'FieldFlow';

export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3000').replace(
  /\/+$/,
  '',
);

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

/** True when the public Supabase configuration is present. */
export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Returns the public Supabase configuration or throws with an actionable
 * message. Called at request time (never at module evaluation) so that a
 * missing `.env.local` produces a readable error instead of a build failure.
 */
export function requireSupabaseConfig(): { url: string; anonKey: string } {
  if (!isSupabaseConfigured()) {
    throw new ConfigurationError(
      'Supabase is not configured. Copy .env.example to .env.local and set ' +
        'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see README.md).',
    );
  }

  return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
}

/**
 * Service-role key. SERVER ONLY — never import this from a client component
 * and never expose it through a `NEXT_PUBLIC_` variable.
 */
export function requireServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!key) {
    throw new ConfigurationError(
      'SUPABASE_SERVICE_ROLE_KEY is not configured. This server-only key is only ' +
        'needed for administrative maintenance tasks (see README.md).',
    );
  }

  return key;
}
