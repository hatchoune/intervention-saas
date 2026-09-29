'use client';

import { useActionState } from 'react';
import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/controls';
import { DangerSubmitButton } from '@/components/ui/modal';
import { SubmitButton } from '@/components/ui/submit-button';
import {
  changeTechnicianStatusAction,
  deleteTechnicianAction,
} from '@/lib/actions/technicians';
import { TECHNICIAN_STATUSES, TECHNICIAN_STATUS_META } from '@/lib/domain/status';
import { IDLE_ACTION_STATE } from '@/lib/errors';
import { cn } from '@/lib/utils/cn';
import type { TechnicianStatus } from '@/types/database';

const DELETE_BUTTON_CLASS =
  'inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600';

/**
 * Availability select that saves on change. Used by managers for the whole team
 * and by technicians for their own profile (the action re-checks both cases).
 */
export function TechnicianStatusControl({
  technicianId,
  status,
  className,
}: {
  technicianId: string;
  status: TechnicianStatus;
  className?: string;
}) {
  const [state, formAction] = useActionState(changeTechnicianStatusAction, IDLE_ACTION_STATE);

  return (
    <form
      action={formAction}
      onChange={(event) => event.currentTarget.requestSubmit()}
      className={cn('flex flex-wrap items-center gap-1.5', className)}
    >
      <input type="hidden" name="technicianId" value={technicianId} />
      <label htmlFor={`status-${technicianId}`} className="sr-only">
        Availability
      </label>
      <Select
        id={`status-${technicianId}`}
        name="status"
        defaultValue={status}
        className="h-9 w-full min-w-[8.5rem] py-0 text-xs sm:w-auto"
      >
        {TECHNICIAN_STATUSES.map((option) => (
          <option key={option} value={option}>
            {TECHNICIAN_STATUS_META[option].label}
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

/** Delete button with a server-side dependency check. */
export function DeleteTechnicianAction({
  technicianId,
  technicianName,
}: {
  technicianId: string;
  technicianName: string;
}) {
  const [state, formAction] = useActionState(deleteTechnicianAction, IDLE_ACTION_STATE);

  return (
    <div className="space-y-2">
      <form action={formAction} className="inline-flex">
        <input type="hidden" name="technicianId" value={technicianId} />
        <DangerSubmitButton
          confirmMessage={`Delete ${technicianName}? Their profile is removed from the team.`}
          className={DELETE_BUTTON_CLASS}
          aria-label={`Delete ${technicianName}`}
          title="Delete technician"
        >
          <Trash2 aria-hidden className="size-4" />
        </DangerSubmitButton>
      </form>
      {state.status === 'error' ? (
        <p role="alert" className="text-xs text-rose-600">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

export { Button };
