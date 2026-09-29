'use client';

import { useActionState, useState } from 'react';
import { Euro, Trash2 } from 'lucide-react';

import { ActionAlert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/controls';
import { Modal, DangerSubmitButton } from '@/components/ui/modal';
import { SubmitButton } from '@/components/ui/submit-button';
import {
  changeInvoiceStatusAction,
  deleteInvoiceAction,
  recordInvoicePaymentAction,
} from '@/lib/actions/invoices';
import { INVOICE_STATUS_META, INVOICE_STATUS_TRANSITIONS } from '@/lib/domain/status';
import { IDLE_ACTION_STATE } from '@/lib/errors';
import { formatCurrency } from '@/lib/utils/format';
import type { InvoiceStatus } from '@/types/database';

/**
 * Status control: only offers the moves legal from the stored status. The
 * trigger-derived statuses (partial/paid/overdue) are self-loops, so they
 * never appear here — payments go through the payment recorder instead.
 */
export function InvoiceStatusControl({
  invoiceId,
  status,
}: {
  invoiceId: string;
  status: InvoiceStatus;
}) {
  const [state, formAction] = useActionState(changeInvoiceStatusAction, IDLE_ACTION_STATE);
  const [target, setTarget] = useState('');

  const allowed = INVOICE_STATUS_TRANSITIONS[status].filter((value) => value !== status);
  if (allowed.length === 0) return null;

  return (
    <form action={formAction} className="space-y-1.5">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <div className="flex items-end gap-2">
        <Field htmlFor="invoice-status" label="Move to" className="min-w-[11rem]">
          <Select
            id="invoice-status"
            name="status"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          >
            <option value="">Choose status…</option>
            {allowed.map((value) => (
              <option key={value} value={value}>
                {INVOICE_STATUS_META[value].label}
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

/**
 * Records a payment. The value posted is the *absolute* total paid on the
 * invoice (not an increment) — it defaults to the outstanding balance, and the
 * database trigger derives `partial`/`paid` (and `paid_at`) from it.
 */
export function RecordPaymentAction({
  invoiceId,
  invoiceNumber,
  total,
  amountPaid,
  balance,
  currency,
}: {
  invoiceId: string;
  invoiceNumber: string;
  total: number;
  amountPaid: number;
  balance: number;
  currency: string;
}) {
  const [state, formAction] = useActionState(recordInvoicePaymentAction, IDLE_ACTION_STATE);
  const [amount, setAmount] = useState(String(balance));

  return (
    <Modal
      title={`Record a payment — ${invoiceNumber}`}
      description="Enter the cumulative amount paid; the status updates automatically."
      trigger={
        <Button variant="success" size="md">
          <Euro aria-hidden className="size-4" />
          Record payment
        </Button>
      }
    >
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="invoiceId" value={invoiceId} />
        <ActionAlert status={state.status} message={state.message} />

        <dl className="space-y-1 rounded-lg bg-slate-50 px-3.5 py-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Invoice total</dt>
            <dd className="font-medium tabular-nums text-slate-800">
              {formatCurrency(total, currency)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Already paid</dt>
            <dd className="tabular-nums text-slate-700">
              {formatCurrency(amountPaid, currency)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-slate-200 pt-1">
            <dt className="font-medium text-slate-700">Outstanding balance</dt>
            <dd className="font-semibold tabular-nums text-slate-900">
              {formatCurrency(balance, currency)}
            </dd>
          </div>
        </dl>

        <Field
          htmlFor="amountPaid"
          label="Total paid to date"
          hint={`Leave ${formatCurrency(balance, currency)} to settle in full, or enter the cumulative amount received.`}
          required
          error={state.fieldErrors?.amountPaid?.[0]}
        >
          <Input
            id="amountPaid"
            name="amountPaid"
            type="number"
            inputMode="decimal"
            min={0}
            max={total}
            step="0.01"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            hasError={Boolean(state.fieldErrors?.amountPaid?.[0])}
          />
        </Field>

        <Field
          htmlFor="paymentMethod"
          label="Payment method"
          error={state.fieldErrors?.paymentMethod?.[0]}
        >
          <Input
            id="paymentMethod"
            name="paymentMethod"
            maxLength={60}
            placeholder="Bank transfer, card, cash…"
          />
        </Field>

        <div className="flex justify-end gap-2">
          <SubmitButton variant="success" pendingLabel="Saving…">
            Save payment
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

/** Deletes a draft invoice (the server refuses any other status). */
export function DeleteInvoiceAction({
  invoiceId,
  invoiceNumber,
}: {
  invoiceId: string;
  invoiceNumber: string;
}) {
  const [state, formAction] = useActionState(deleteInvoiceAction, IDLE_ACTION_STATE);

  return (
    <div className="space-y-1">
      <form action={formAction} className="inline-flex">
        <input type="hidden" name="invoiceId" value={invoiceId} />
        <DangerSubmitButton
          confirmMessage={`Delete ${invoiceNumber}? This cannot be undone.`}
          className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
          aria-label={`Delete ${invoiceNumber}`}
          title="Delete invoice"
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
