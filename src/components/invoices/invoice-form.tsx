'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { LineItemEditor } from '@/components/documents/line-item-editor';
import { ActionAlert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/controls';
import { SubmitButton } from '@/components/ui/submit-button';
import { createInvoiceAction, updateInvoiceAction } from '@/lib/actions/invoices';
import type { CustomerOption } from '@/lib/db/interventions';
import { DISCOUNT_TYPE_LABELS } from '@/lib/domain/status';
import { IDLE_ACTION_STATE } from '@/lib/errors';
import type { DiscountType, InvoiceStatus } from '@/types/database';
import type { EditableLine } from '@/lib/validation/document';

/**
 * Create / edit form for an invoice.
 *
 * Only drafts can be updated (the server enforces it), so on update the
 * lifecycle fields are posted back unchanged: `status`, `amount_paid` and
 * `payment_method` are owned by the status control and the payment recorder,
 * never by this form.
 */

export interface InvoiceFormDefaults {
  id: string | null;
  customerId: string;
  interventionId: string | null;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  discountType: DiscountType;
  discountValue: string;
  notes: string;
  internalNotes: string;
  paymentTerms: string;
  paymentMethod: string;
  amountPaid: string;
  lines: EditableLine[];
}

export interface InvoiceFormProps {
  mode: 'create' | 'update';
  customers: CustomerOption[];
  defaults: InvoiceFormDefaults;
  currency: string;
  cancelHref: string;
}

export function InvoiceForm({ mode, customers, defaults, currency, cancelHref }: InvoiceFormProps) {
  const [state, formAction] = useActionState(
    mode === 'create' ? createInvoiceAction : updateInvoiceAction,
    IDLE_ACTION_STATE,
  );

  const fieldError = (field: string): string | undefined => state.fieldErrors?.[field]?.[0];

  return (
    <form action={formAction} className="space-y-6">
      <ActionAlert status={state.status} message={state.message} />

      {mode === 'update' ? (
        <>
          <input type="hidden" name="id" value={defaults.id ?? ''} />
          <input type="hidden" name="status" value={defaults.status} />
          <input type="hidden" name="amountPaid" value={defaults.amountPaid} />
          <input type="hidden" name="paymentMethod" value={defaults.paymentMethod} />
        </>
      ) : null}
      {defaults.interventionId ? (
        <input type="hidden" name="interventionId" value={defaults.interventionId} />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle as="h2">Invoice details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="customerId" label="Customer" required error={fieldError('customerId')}>
            <Select
              id="customerId"
              name="customerId"
              required
              defaultValue={defaults.customerId}
              hasError={Boolean(fieldError('customerId'))}
            >
              <option value="">Select a customer…</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field htmlFor="issueDate" label="Issue date" required error={fieldError('issueDate')}>
            <Input
              id="issueDate"
              name="issueDate"
              type="date"
              required
              defaultValue={defaults.issueDate}
              hasError={Boolean(fieldError('issueDate'))}
            />
          </Field>

          <Field
            htmlFor="dueDate"
            label="Due date"
            hint="Leave empty for no payment deadline."
            error={fieldError('dueDate')}
          >
            <Input
              id="dueDate"
              name="dueDate"
              type="date"
              defaultValue={defaults.dueDate}
              hasError={Boolean(fieldError('dueDate'))}
            />
          </Field>

          <Field htmlFor="discountType" label="Global discount" error={fieldError('discountType')}>
            <Select id="discountType" name="discountType" defaultValue={defaults.discountType}>
              {(['none', 'percentage', 'fixed'] as DiscountType[]).map((value) => (
                <option key={value} value={value}>
                  {DISCOUNT_TYPE_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            htmlFor="discountValue"
            label="Discount value"
            hint="Amount or percentage, depending on the type above."
            error={fieldError('discountValue')}
          >
            <Input
              id="discountValue"
              name="discountValue"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              defaultValue={defaults.discountValue}
              hasError={Boolean(fieldError('discountValue'))}
            />
          </Field>
          <Field
            htmlFor="paymentTerms"
            label="Payment terms"
            hint="Shown on the invoice, e.g. “30 days end of month”."
            className="sm:col-span-2"
            error={fieldError('paymentTerms')}
          >
            <Input
              id="paymentTerms"
              name="paymentTerms"
              maxLength={300}
              defaultValue={defaults.paymentTerms}
              hasError={Boolean(fieldError('paymentTerms'))}
            />
          </Field>

          <Field
            htmlFor="notes"
            label="Notes for the customer"
            className="sm:col-span-2"
            error={fieldError('notes')}
          >
            <Textarea id="notes" name="notes" defaultValue={defaults.notes} maxLength={4000} />
          </Field>

          <Field
            htmlFor="internalNotes"
            label="Internal notes"
            hint="Never shown to the customer."
            className="sm:col-span-2"
            error={fieldError('internalNotes')}
          >
            <Textarea
              id="internalNotes"
              name="internalNotes"
              defaultValue={defaults.internalNotes}
              maxLength={4000}
            />
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-5">
          <LineItemEditor
            defaultValue={defaults.lines}
            currency={currency}
            error={fieldError('lines')}
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link href={cancelHref} className={buttonClasses('outline', 'md')}>
          Cancel
        </Link>
        <SubmitButton pendingLabel="Saving…">
          {mode === 'create' ? 'Create invoice' : 'Save changes'}
        </SubmitButton>
      </div>
    </form>
  );
}
