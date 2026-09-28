import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

import { can, defaultRouteFor, type Capability } from '@/lib/domain/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type {
  CurrentUserOrganization,
  OrganizationRow,
  OrganizationRole,
  ProfileRow,
} from '@/types/database';

/** Cookie holding the organisation currently selected in the org switcher. */
export const ACTIVE_ORGANIZATION_COOKIE = 'active_organization_id';

export interface SessionContext {
  user: User;
  profile: ProfileRow | null;
  /** Null when the user has not created or joined an organisation yet. */
  organization: OrganizationRow | null;
  role: OrganizationRole | null;
  memberships: CurrentUserOrganization[];
}

/** Signed-in user without organisation resolution (used by the auth pages). */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ?? null;
});

/**
 * Resolves the full session context: user, profile, active organisation and
 * role. The active organisation comes from a cookie but is always validated
 * against the user's real memberships — a forged cookie cannot elevate access.
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: profileData }, { data: membershipData }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.rpc('current_user_organizations'),
  ]);

  const memberships = (membershipData ?? []) as CurrentUserOrganization[];
  const cookieStore = await cookies();
  const requestedId = cookieStore.get(ACTIVE_ORGANIZATION_COOKIE)?.value;

  const active =
    memberships.find((membership) => membership.organization_id === requestedId) ?? memberships[0];

  if (!active) {
    return { user, profile: profileData ?? null, organization: null, role: null, memberships };
  }

  const { data: organization } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', active.organization_id)
    .maybeSingle();

  if (!organization) {
    return { user, profile: profileData ?? null, organization: null, role: null, memberships };
  }

  return {
    user,
    profile: profileData ?? null,
    organization,
    role: active.role,
    memberships,
  };
});

/** Same as `getSessionContext` but redirects unauthenticated visitors. */
export async function requireSession(nextPath?: string): Promise<SessionContext> {
  const session = await getSessionContext();

  if (!session) {
    const target = nextPath ? `/sign-in?next=${encodeURIComponent(nextPath)}` : '/sign-in';
    redirect(target);
  }

  return session;
}

/**
 * Requires a session *and* an organisation. Users who signed up but have not
 * created or joined an organisation are sent to the onboarding flow.
 */
export async function requireOrganization(nextPath?: string): Promise<
  SessionContext & { organization: OrganizationRow; role: OrganizationRole }
> {
  const session = await requireSession(nextPath);

  if (!session.organization || !session.role) {
    redirect('/onboarding');
  }

  return session as SessionContext & { organization: OrganizationRow; role: OrganizationRole };
}

/** Requires a session, an organisation, and a role allowed to do X. */
export async function requireCapability(
  capability: Capability,
  nextPath?: string,
): Promise<SessionContext & { organization: OrganizationRow; role: OrganizationRole }> {
  const session = await requireOrganization(nextPath);

  if (!can(capability, session.role)) {
    redirect('/dashboard?error=forbidden');
  }

  return session;
}

/** Convenience wrapper used by the app shell. */
export async function requireOnboardedSession(): Promise<SessionContext> {
  const session = await requireOrganization();
  return session;
}

export { defaultRouteFor };
