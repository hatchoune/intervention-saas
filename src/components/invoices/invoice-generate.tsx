'use client';

import { useActionState, useState } from 'react';
import { Wrench } from 'lucide-react';

import { ActionAlert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/controls';
import { Modal } from '@/components/ui/modal';
import { SubmitButton } from '@/components/ui/submit-button';
import { createInvoiceFromInterventionAction } from '@/lib/actions/invoices';
import type { ActionState } from '@/lib/errors';
import type { BillableIntervention } from '@/lib/db/invoices';

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
}

/**
 * "Generate from an intervention" flow offered on the invoice creation page.
 * The RPC bills an accepted quote attached to the intervention when there is
 * one, otherwise it creates a single flat-rate line.
 */
export function InvoiceFromInterventionAction({
  interventions,
}: {
  interventions: BillableIntervention[];
}) {
  const [state, formAction] = useActionState<ActionState<{ invoiceId: string }>, FormData>(
    createInvoiceFromInterventionAction,
    { status: 'idle' },
  );
  const [interventionId, setInterventionId] = useState('');

  return (
    <Modal
      title="Generate an invoice from an intervention"
      description="Completed interventions that are not invoiced yet. When an accepted quote is attached, its lines are billed instead of a flat-rate line."
      trigger={
        <Button variant="outline" size="md">
          <Wrench aria-hidden className="size-4" />
          From an intervention
        </Button>
      }
    >
      {interventions.length === 0 ? (
        <p className="text-sm text-slate-500">
          No completed intervention is waiting to be invoiced.
        </p>
      ) : (
        <form action={formAction} className="space-y-4">
          <ActionAlert status={state.status} message={state.message} />

          <Field
            htmlFor="interventionId"
            label="Intervention"
            required
            error={state.fieldErrors?.interventionId?.[0]}
          >
            <Select
              id="interventionId"
              name="interventionId"
              required
              value={interventionId}
              onChange={(event) => setInterventionId(event.target.value)}
            >
              <option value="">Choose an intervention…</option>
              {interventions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.reference} — {item.customerName} ({item.title})
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              htmlFor="from-issueDate"
              label="Issue date"
              error={state.fieldErrors?.issueDate?.[0]}
            >
              <Input
                id="from-issueDate"
                name="issueDate"
                type="date"
                defaultValue={todayKey()}
              />
            </Field>
            <Field htmlFor="from-dueDate" label="Due date" error={state.fieldErrors?.dueDate?.[0]}>
              <Input id="from-dueDate" name="dueDate" type="date" />
            </Field>
          </div>

          <div className="flex justify-end">
            <SubmitButton disabled={!interventionId} pendingLabel="Generating…">
              Generate invoice
            </SubmitButton>
          </div>
        </form>
      )}
    </Modal>
  );
}
