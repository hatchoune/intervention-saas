import { NavigationShell } from '@/components/layout/navigation-shell';
import { buildNavSections, primaryNavItems } from '@/components/layout/nav-config';
import { TopBar } from '@/components/layout/topbar';
import { requireOrganization } from '@/lib/auth/session';
import { ORGANIZATION_ROLE_META } from '@/lib/domain/status';

/**
 * Every page in this shell resolves the Supabase session from cookies, so the
 * whole segment renders per request — the build never needs a database.
 */
export const dynamic = 'force-dynamic';

/**
 * Authenticated application shell. Every page under `(app)` renders inside it,
 * so `requireOrganization()` guarantees there is a session *and* a tenant.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireOrganization();
  const { organization, role } = session;

  const sections = buildNavSections(role);
  const primaryItems = primaryNavItems(role);

  return (
    <div className="min-h-dvh bg-slate-50">
      <NavigationShell
        sections={sections}
        primaryItems={primaryItems}
        organizationName={organization.name}
        roleLabel={ORGANIZATION_ROLE_META[role].label}
        userName={session.profile?.full_name ?? null}
        userEmail={session.user.email ?? ''}
      />

      <div className="lg:pl-64">
        <TopBar organization={organization} role={role} session={session} />
        <main id="main" className="mx-auto w-full max-w-7xl px-4 pt-4 pb-28 sm:px-6 lg:pb-10">
          {children}
        </main>
      </div>
    </div>
  );
}
