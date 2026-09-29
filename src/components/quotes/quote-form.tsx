'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { LineItemEditor } from '@/components/documents/line-item-editor';
import { ActionAlert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/controls';
import { SubmitButton } from '@/components/ui/submit-button';
import { createQuoteAction, updateQuoteAction } from '@/lib/actions/quotes';
import type { CustomerOption } from '@/lib/db/interventions';
import { DISCOUNT_TYPE_LABELS } from '@/lib/domain/status';
import { IDLE_ACTION_STATE } from '@/lib/errors';
import type { DiscountType, QuoteStatus } from '@/types/database';
import type { EditableLine } from '@/lib/validation/document';

/**
 * Create / edit form for a quote.
 *
 * On update the current `status` is posted back unchanged: lifecycle moves
 * belong to the status control on the detail page (the action validates them
 * against `QUOTE_TRANSITIONS`), so the form can never smuggle a transition in.
 */

export interface QuoteFormDefaults {
  id: string | null;
  customerId: string;
  interventionId: string | null;
  status: QuoteStatus;
  issueDate: string;
  validUntil: string;
  discountType: DiscountType;
  discountValue: string;
  notes: string;
  internalNotes: string;
  lines: EditableLine[];
}

export interface QuoteFormProps {
  mode: 'create' | 'update';
  customers: CustomerOption[];
  defaults: QuoteFormDefaults;
  currency: string;
  cancelHref: string;
}

export function QuoteForm({ mode, customers, defaults, currency, cancelHref }: QuoteFormProps) {
  const [state, formAction] = useActionState(
    mode === 'create' ? createQuoteAction : updateQuoteAction,
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
        </>
      ) : null}
      {defaults.interventionId ? (
        <input type="hidden" name="interventionId" value={defaults.interventionId} />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle as="h2">Quote details</CardTitle>
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
            htmlFor="validUntil"
            label="Valid until"
            hint="Leave empty for no expiry."
            error={fieldError('validUntil')}
          >
            <Input
              id="validUntil"
              name="validUntil"
              type="date"
              defaultValue={defaults.validUntil}
              hasError={Boolean(fieldError('validUntil'))}
            />
          </Field>

          <Field
            htmlFor="discountType"
            label="Global discount"
            error={fieldError('discountType')}
          >
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
          {mode === 'create' ? 'Create quote' : 'Save changes'}
        </SubmitButton>
      </div>
    </form>
  );
}
