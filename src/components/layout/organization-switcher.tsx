'use client';

import { useActionState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';

import { switchOrganizationAction } from '@/lib/actions/organization';
import { IDLE_ACTION_STATE } from '@/lib/errors';
import { ORGANIZATION_ROLE_META } from '@/lib/domain/status';
import type { CurrentUserOrganization } from '@/types/database';

/**
 * Organisation switcher. The cookie it writes is re-validated server-side
 * against the user's real memberships, so it cannot be used to escalate access.
 */
export function OrganizationSwitcher({
  memberships,
  activeId,
}: {
  memberships: CurrentUserOrganization[];
  activeId: string;
}) {
  const [state, formAction] = useActionState(switchOrganizationAction, IDLE_ACTION_STATE);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'success') {
      startTransition(() => router.refresh());
    }
  }, [state, router]);

  if (memberships.length <= 1) {
    return (
      <span className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-600 sm:inline-flex">
        <Building2 aria-hidden className="size-4 text-slate-400" />
        <span className="max-w-[14rem] truncate">{memberships[0]?.name ?? 'Organisation'}</span>
      </span>
    );
  }

  return (
    <form
      action={formAction}
      className="hidden sm:block"
      onChange={(event) => event.currentTarget.requestSubmit()}
    >
      <label htmlFor="organization-switcher" className="sr-only">
        Active organisation
      </label>
      <select
        id="organization-switcher"
        name="organizationId"
        defaultValue={activeId}
        disabled={isPending}
        className="h-9 max-w-[16rem] rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
      >
        {memberships.map((membership) => (
          <option key={membership.organization_id} value={membership.organization_id}>
            {membership.name} — {ORGANIZATION_ROLE_META[membership.role].label}
          </option>
        ))}
      </select>
      {state.status === 'error' ? (
        <span role="alert" className="sr-only">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
