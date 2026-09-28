'use client';

import { useActionState } from 'react';
import { Trash2 } from 'lucide-react';

import { ActionAlert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/controls';
import { DangerSubmitButton, Modal } from '@/components/ui/modal';
import { SubmitButton } from '@/components/ui/submit-button';
import {
  removeMemberAction,
  revokeInvitationAction,
  updateMemberRoleAction,
} from '@/lib/actions/team';
import { ORGANIZATION_ROLE_META, ORGANIZATION_ROLES } from '@/lib/domain/status';
import { IDLE_ACTION_STATE } from '@/lib/errors';
import type { OrganizationRole } from '@/types/database';

const DELETE_BUTTON_CLASS =
  'inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600';

/** Role selector that saves on change. */
export function MemberRoleForm({
  membershipId,
  role,
  disabled,
}: {
  membershipId: string;
  role: OrganizationRole;
  disabled?: boolean;
}) {
  const [state, formAction] = useActionState(updateMemberRoleAction, IDLE_ACTION_STATE);

  return (
    <form
      action={formAction}
      onChange={(event) => event.currentTarget.requestSubmit()}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="membershipId" value={membershipId} />
      <label htmlFor={`role-${membershipId}`} className="sr-only">
        Role
      </label>
      <Select
        id={`role-${membershipId}`}
        name="role"
        defaultValue={role}
        disabled={disabled}
        className="h-9 w-full min-w-[9rem] py-0 text-xs sm:w-auto"
      >
        {ORGANIZATION_ROLES.map((option) => (
          <option key={option} value={option}>
            {ORGANIZATION_ROLE_META[option].label}
          </option>
        ))}
      </Select>
      <noscript>
        <SubmitButton size="sm" variant="outline">
          Save
        </SubmitButton>
      </noscript>
      {state.status === 'error' ? (
        <span role="alert" className="text-xs text-rose-600">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

export function RemoveMemberAction({
  membershipId,
  memberName,
}: {
  membershipId: string;
  memberName: string;
}) {
  const [state, formAction] = useActionState(removeMemberAction, IDLE_ACTION_STATE);

  return (
    <>
      {state.status !== 'idle' && state.status === 'error' ? (
        <ActionAlert status={state.status} message={state.message} className="mb-2" />
      ) : null}
      <form action={formAction} className="inline-flex">
        <input type="hidden" name="membershipId" value={membershipId} />
        <DangerSubmitButton
          confirmMessage={`Remove ${memberName} from the organisation? They will lose access immediately.`}
          className={DELETE_BUTTON_CLASS}
          aria-label={`Remove ${memberName}`}
          title="Remove from organisation"
        >
          <Trash2 aria-hidden className="size-4" />
        </DangerSubmitButton>
      </form>
    </>
  );
}

export function RevokeInvitationAction({ invitationId }: { invitationId: string }) {
  const [state, formAction] = useActionState(revokeInvitationAction, IDLE_ACTION_STATE);

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="invitationId" value={invitationId} />
      <Button type="submit" variant="ghost" size="sm">
        Revoke
      </Button>
      {state.status === 'error' ? (
        <span role="alert" className="text-xs text-rose-600">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

export { Modal };
