'use client';

import { useActionState } from 'react';

import { ActionAlert } from '@/components/ui/alert';
import { Field, Input } from '@/components/ui/controls';
import { SubmitButton } from '@/components/ui/submit-button';
import { createOrganizationAction } from '@/lib/actions/organization';
import { IDLE_ACTION_STATE } from '@/lib/errors';

const CURRENCIES = ['EUR', 'CHF', 'GBP', 'USD', 'CAD', 'MAD', 'TND', 'DZD'];

export function CreateOrganizationForm({ defaultName }: { defaultName?: string }) {
  const [state, formAction] = useActionState(createOrganizationAction, IDLE_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status !== 'idle' ? (
        <ActionAlert status={state.status} message={state.message} />
      ) : null}

      <Field
        htmlFor="name"
        label="Company name"
        required
        error={state.fieldErrors?.name?.[0]}
      >
        <Input
          id="name"
          name="name"
          required
          defaultValue={defaultName}
          placeholder="Dupont Plumbing"
          hasError={Boolean(state.fieldErrors?.name)}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="country" label="Country">
          <Input id="country" name="country" defaultValue="FR" maxLength={2} />
        </Field>

        <Field htmlFor="currency" label="Currency">
          <select
            id="currency"
            name="currency"
            defaultValue="EUR"
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
          >
            {CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <SubmitButton className="w-full" pendingLabel="Creating…">
        Create the organisation
      </SubmitButton>
    </form>
  );
}
