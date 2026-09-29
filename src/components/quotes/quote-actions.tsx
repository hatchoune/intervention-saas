'use client';

import { useActionState, useState } from 'react';
import { FileText, Trash2 } from 'lucide-react';

import { Field, Select } from '@/components/ui/controls';
import { DangerSubmitButton } from '@/components/ui/modal';
import { SubmitButton } from '@/components/ui/submit-button';
import {
  changeQuoteStatusAction,
  convertQuoteToInvoiceAction,
  deleteQuoteAction,
} from '@/lib/actions/quotes';
import { QUOTE_STATUS_META, QUOTE_STATUS_TRANSITIONS } from '@/lib/domain/status';
import { IDLE_ACTION_STATE, type ActionState } from '@/lib/errors';
import type { QuoteStatus } from '@/types/database';

/**
 * Converts an accepted quote into a draft invoice. The action redirects to the
 * new invoice on success, so only errors are rendered here.
 */
export function ConvertQuoteToInvoiceAction({ quoteId }: { quoteId: string }) {
  const [state, formAction] = useActionState<ActionState<{ invoiceId: string }>, FormData>(
    convertQuoteToInvoiceAction,
    { status: 'idle' },
  );

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="quoteId" value={quoteId} />
      <SubmitButton pendingLabel="Generating…">
        <FileText aria-hidden className="size-4" />
        Generate invoice
      </SubmitButton>
      {state.status === 'error' ? (
        <p role="alert" className="max-w-xs text-xs text-rose-600">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

/** Deletes a draft quote (the server refuses any other status). */
export function DeleteQuoteAction({
  quoteId,
  quoteNumber,
}: {
  quoteId: string;
  quoteNumber: string;
}) {
  const [state, formAction] = useActionState(deleteQuoteAction, IDLE_ACTION_STATE);

  return (
    <div className="space-y-1">
      <form action={formAction} className="inline-flex">
        <input type="hidden" name="quoteId" value={quoteId} />
        <DangerSubmitButton
          confirmMessage={`Delete ${quoteNumber}? This cannot be undone.`}
          className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
          aria-label={`Delete ${quoteNumber}`}
          title="Delete quote"
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

/**
 * Status control: a select of the transitions legal from the current status.
 * The server re-validates the move, so a stale client can never perform an
 * illegal transition.
 */
export function QuoteStatusControl({
  quoteId,
  status,
}: {
  quoteId: string;
  status: QuoteStatus;
}) {
  const [state, formAction] = useActionState(changeQuoteStatusAction, IDLE_ACTION_STATE);
  const [target, setTarget] = useState('');

  const allowed = QUOTE_STATUS_TRANSITIONS[status].filter((value) => value !== status);
  if (allowed.length === 0) return null;

  return (
    <form action={formAction} className="space-y-1.5">
      <input type="hidden" name="quoteId" value={quoteId} />
      <div className="flex items-end gap-2">
        <Field htmlFor="quote-status" label="Move to" className="min-w-[11rem]">
          <Select
            id="quote-status"
            name="status"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          >
            <option value="">Choose status…</option>
            {allowed.map((value) => (
              <option key={value} value={value}>
                {QUOTE_STATUS_META[value].label}
              </option>
            ))}
          </Select>
        </Field>
        <SubmitButton
          variant="outline"
          size="md"
          disabled={!target}
          pendingLabel="Saving…"
          className="mb-0.5"
        >
          Apply
        </SubmitButton>
      </div>
      {state.status === 'error' ? (
        <p role="alert" className="text-xs text-rose-600">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
