import Link from 'next/link';
import { ChevronDown, Plus, UserCircle } from 'lucide-react';

import { OrganizationSwitcher } from '@/components/layout/organization-switcher';
import { buttonClasses } from '@/components/ui/button';
import { Avatar } from '@/components/ui/data-display';
import { can } from '@/lib/domain/permissions';
import { ORGANIZATION_ROLE_META } from '@/lib/domain/status';
import type { SessionContext } from '@/lib/auth/session';
import type { OrganizationRow, OrganizationRole } from '@/types/database';

/**
 * Desktop top bar: organisation switcher, primary action and account menu.
 * The account menu uses `<details>` so no JavaScript is required.
 */
export function TopBar({
  organization,
  role,
  session,
}: {
  organization: OrganizationRow;
  role: OrganizationRole;
  session: SessionContext;
}) {
  const displayName = session.profile?.full_name ?? session.user.email ?? 'Account';

  return (
    <div className="hidden items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-2.5 lg:flex print-hidden">
      <div className="flex items-center gap-2">
        <OrganizationSwitcher
          memberships={session.memberships}
          activeId={organization.id}
        />
        <span className="text-xs text-slate-400">
          {ORGANIZATION_ROLE_META[role].label}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {can('interventions.manage', role) ? (
          <Link href="/interventions/new" className={buttonClasses('primary', 'sm')}>
            <Plus aria-hidden className="size-4" />
            New intervention
          </Link>
        ) : null}

        <details className="group relative">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-100">
            <Avatar name={displayName} size="sm" />
            <span className="max-w-[10rem] truncate">{displayName}</span>
            <ChevronDown aria-hidden className="size-3.5 text-slate-400" />
          </summary>
          <div className="absolute right-0 z-40 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            <div className="border-b border-slate-100 px-3 py-2">
              <p className="truncate text-sm font-medium text-slate-800">{displayName}</p>
              <p className="truncate text-xs text-slate-500">{session.user.email}</p>
            </div>
            <Link
              href="/settings/profile"
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              <UserCircle aria-hidden className="size-4" />
              My profile
            </Link>
          </div>
        </details>
      </div>
    </div>
  );
}
