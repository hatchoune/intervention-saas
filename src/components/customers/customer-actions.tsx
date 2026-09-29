'use client';

import { useActionState } from 'react';
import { Archive, RotateCcw, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DangerSubmitButton } from '@/components/ui/modal';
import {
  changeCustomerStatusAction,
  deleteCustomerAction,
} from '@/lib/actions/customers';
import { IDLE_ACTION_STATE } from '@/lib/errors';
import type { CustomerStatus } from '@/types/database';

/** Archive / reactivate toggle. Archiving keeps every document and history row. */
export function CustomerStatusToggle({
  customerId,
  status,
  customerName,
}: {
  customerId: string;
  status: CustomerStatus;
  customerName: string;
}) {
  const [state, formAction] = useActionState(changeCustomerStatusAction, IDLE_ACTION_STATE);
  const next: CustomerStatus = status === 'active' ? 'archived' : 'active';

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={customerId} />
      <input type="hidden" name="status" value={next} />
      <Button
        type="submit"
        variant="outline"
        size="md"
        aria-label={next === 'archived' ? `Archive ${customerName}` : `Reactivate ${customerName}`}
      >
        {next === 'archived' ? (
          <Archive aria-hidden className="size-4" />
        ) : (
          <RotateCcw aria-hidden className="size-4" />
        )}
        {next === 'archived' ? 'Archive' : 'Reactivate'}
      </Button>
      {state.status === 'error' ? (
        <span role="alert" className="text-xs text-rose-600">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

/** Delete button; the server refuses while documents still reference the customer. */
export function DeleteCustomerAction({
  customerId,
  customerName,
}: {
  customerId: string;
  customerName: string;
}) {
  const [state, formAction] = useActionState(deleteCustomerAction, IDLE_ACTION_STATE);

  return (
    <div className="space-y-1">
      <form action={formAction} className="inline-flex">
        <input type="hidden" name="id" value={customerId} />
        <DangerSubmitButton
          confirmMessage={`Delete ${customerName}? This cannot be undone.`}
          className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
          aria-label={`Delete ${customerName}`}
          title="Delete customer"
        >
          <Trash2 aria-hidden className="size-4" />
        </DangerSubmitButton>
      </form>
      {state.status === 'error' ? (
        <p role="alert" className="max-w-xs text-xs text-rose-600">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
