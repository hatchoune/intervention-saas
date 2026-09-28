'use client';

import { useActionState } from 'react';

import { ActionAlert } from '@/components/ui/alert';
import { Field, Input, Textarea } from '@/components/ui/controls';
import { SubmitButton } from '@/components/ui/submit-button';
import { updateOrganizationProfileAction } from '@/lib/actions/organization';
import { IDLE_ACTION_STATE } from '@/lib/errors';
import type { OrganizationRow } from '@/types/database';

const CURRENCIES = ['EUR', 'CHF', 'GBP', 'USD', 'CAD', 'MAD', 'TND', 'DZD'];

const SELECT_CLASS =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none';

export function OrganizationProfileForm({ organization }: { organization: OrganizationRow }) {
  const [state, formAction] = useActionState(updateOrganizationProfileAction, IDLE_ACTION_STATE);

  const error = (field: string) => state.fieldErrors?.[field]?.[0];
  const invalid = (field: string) => Boolean(state.fieldErrors?.[field]);

  return (
    <form action={formAction} className="space-y-8" noValidate>
      {state.status !== 'idle' ? (
        <ActionAlert status={state.status} message={state.message} />
      ) : null}

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-slate-900">Identity</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="name" label="Trading name" required error={error('name')}>
            <Input id="name" name="name" defaultValue={organization.name} hasError={invalid('name')} />
          </Field>
          <Field htmlFor="legalName" label="Legal name" error={error('legalName')}>
            <Input id="legalName" name="legalName" defaultValue={organization.legal_name ?? ''} />
          </Field>
          <Field htmlFor="vatNumber" label="VAT number" error={error('vatNumber')}>
            <Input id="vatNumber" name="vatNumber" defaultValue={organization.vat_number ?? ''} />
          </Field>
          <Field
            htmlFor="registrationNumber"
            label="Registration number"
            error={error('registrationNumber')}
          >
            <Input
              id="registrationNumber"
              name="registrationNumber"
              defaultValue={organization.registration_number ?? ''}
            />
          </Field>
          <Field htmlFor="email" label="Contact e-mail" error={error('email')}>
            <Input id="email" name="email" type="email" defaultValue={organization.email ?? ''} />
          </Field>
          <Field htmlFor="phone" label="Contact phone" error={error('phone')}>
            <Input id="phone" name="phone" type="tel" defaultValue={organization.phone ?? ''} />
          </Field>
          <Field htmlFor="website" label="Website" error={error('website')} className="sm:col-span-2">
            <Input id="website" name="website" defaultValue={organization.website ?? ''} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-slate-900">Address</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            htmlFor="addressLine1"
            label="Address"
            error={error('addressLine1')}
            className="sm:col-span-2"
          >
            <Input
              id="addressLine1"
              name="addressLine1"
              defaultValue={organization.address_line1 ?? ''}
            />
          </Field>
          <Field htmlFor="postalCode" label="Postal code">
            <Input id="postalCode" name="postalCode" defaultValue={organization.postal_code ?? ''} />
          </Field>
          <Field htmlFor="city" label="City">
            <Input id="city" name="city" defaultValue={organization.city ?? ''} />
          </Field>
          <Field htmlFor="country" label="Country" hint="2-letter code, e.g. FR" error={error('country')}>
            <Input
              id="country"
              name="country"
              maxLength={2}
              defaultValue={organization.country ?? 'FR'}
            />
          </Field>
        </div>
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-slate-900">Billing defaults</legend>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field htmlFor="currency" label="Currency" error={error('currency')}>
            <select
              id="currency"
              name="currency"
              defaultValue={organization.currency}
              className={SELECT_CLASS}
            >
              {CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </Field>
          <Field
            htmlFor="defaultVatRate"
            label="Default VAT rate (%)"
            hint="Applied to new document lines"
            error={error('defaultVatRate')}
          >
            <Input
              id="defaultVatRate"
              name="defaultVatRate"
              inputMode="decimal"
              defaultValue={organization.default_vat_rate}
            />
          </Field>
          <Field
            htmlFor="paymentTermsDays"
            label="Payment terms (days)"
            hint="Due date = issue date + terms"
            error={error('paymentTermsDays')}
          >
            <Input
              id="paymentTermsDays"
              name="paymentTermsDays"
              inputMode="numeric"
              defaultValue={organization.payment_terms_days}
            />
          </Field>
          <Field htmlFor="timezone" label="Timezone" className="sm:col-span-3">
            <Input id="timezone" name="timezone" defaultValue={organization.timezone} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-slate-900">Document footers</legend>

        <Field htmlFor="quoteFooter" label="Quote footer" hint="Shown at the bottom of every quote">
          <Textarea
            id="quoteFooter"
            name="quoteFooter"
            rows={3}
            defaultValue={organization.quote_footer ?? ''}
          />
        </Field>
        <Field htmlFor="invoiceFooter" label="Invoice footer" hint="Payment terms, legal mentions…">
          <Textarea
            id="invoiceFooter"
            name="invoiceFooter"
            rows={3}
            defaultValue={organization.invoice_footer ?? ''}
          />
        </Field>
      </fieldset>

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving…">Save settings</SubmitButton>
      </div>
    </form>
  );
}

