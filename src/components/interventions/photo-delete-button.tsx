'use client';

import { useActionState } from 'react';

import { ActionAlert } from '@/components/ui/alert';
import { SubmitButton } from '@/components/ui/submit-button';
import { deleteInterventionPhotoAction } from '@/lib/actions/interventions';
import { IDLE_ACTION_STATE } from '@/lib/errors';

/** Removes an evidence photo (row + storage object) after a confirmation. */
export function PhotoDeleteButton({ photoId, label }: { photoId: string; label: string }) {
  const [state, formAction] = useActionState(deleteInterventionPhotoAction, IDLE_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="photoId" value={photoId} />
      <SubmitButton
        variant="danger"
        size="sm"
        pendingLabel="Removing…"
        aria-label={`Remove photo ${label}`}
        onClick={(event) => {
          if (!window.confirm(`Remove the photo "${label}"? This cannot be undone.`)) {
            event.preventDefault();
          }
        }}
      >
        Remove
      </SubmitButton>
      {state.status === 'error' ? <ActionAlert status={state.status} message={state.message} /> : null}
    </form>
  );
}
