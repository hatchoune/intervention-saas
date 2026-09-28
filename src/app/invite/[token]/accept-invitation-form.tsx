'use client';

import { useActionState } from 'react';

import { ActionAlert } from '@/components/ui/alert';
import { SubmitButton } from '@/components/ui/submit-button';
import { acceptInvitationAction } from '@/lib/actions/organization';
import { IDLE_ACTION_STATE } from '@/lib/errors';

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(acceptInvitationAction, IDLE_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-4">
      {state.status !== 'idle' ? (
        <ActionAlert status={state.status} message={state.message} />
      ) : null}

      <input type="hidden" name="token" value={token} />

      <SubmitButton className="w-full" pendingLabel="Joining…">
        Join this organisation
      </SubmitButton>
    </form>
  );
}
