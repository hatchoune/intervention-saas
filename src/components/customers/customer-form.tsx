'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';

import { ActionAlert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/controls';
import { SubmitButton } from '@/components/ui/submit-button';
import { createCustomerAction, updateCustomerAction } from '@/lib/actions/customers';
import { CUSTOMER_STATUS_META, CUSTOMER_TYPE_META } from '@/lib/domain/status';
import { IDLE_ACTION_STATE } from '@/lib/errors';
import type { CustomerStatus, CustomerType } from '@/types/database';

/**
 * Create / edit form for a customer.
 *
 * The customer type drives which name fields are shown: a company has a legal
 * name plus an optional contact, an individual has a first and last name. The
 * database derives the searchable `name` column and enforces the same rule with
 * the `customers_name_present` constraint.
 */

export interface CustomerFormDefaults {
  id: string | null;
  type: CustomerType;
  status: CustomerStatus;
  firstName: string;
  lastName: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  mobile: string;
  website: string;
  vatNumber: string;
  registrationNumber: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  country: string;
  tags: string;
  notes: string;
}

export interface CustomerFormProps {
  mode: 'create' | 'update';
  defaults: CustomerFormDefaults;
  cancelHref: string;
}

export function CustomerForm({ mode, defaults, cancelHref }: CustomerFormProps) {
  const [state, formAction] = useActionState(
    mode === 'create' ? createCustomerAction : updateCustomerAction,
    IDLE_ACTION_STATE,
  );
  const [type, setType] = useState<CustomerType>(defaults.type);

  const fieldError = (field: string): string | undefined => state.fieldErrors?.[field]?.[0];

  return (
    <form action={formAction} className="space-y-6">
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <ActionAlert status={state.status} message={state.message} />

      <Card>
        <CardHeader>
          <CardTitle as="h2">Customer</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="type" label="Type" required>
            <Select
              id="type"
              name="type"
              value={type}
              onChange={(event) => setType(event.target.value as CustomerType)}
            >
              <option value="individual">{CUSTOMER_TYPE_META.individual.label}</option>
              <option value="company">{CUSTOMER_TYPE_META.company.label}</option>
            </Select>
          </Field>

          <Field htmlFor="status" label="Status" hint={CUSTOMER_STATUS_META[defaults.status].description}>
            <Select id="status" name="status" defaultValue={defaults.status}>
              <option value="active">{CUSTOMER_STATUS_META.active.label}</option>
              <option value="archived">{CUSTOMER_STATUS_META.archived.label}</option>
            </Select>
          </Field>

          {type === 'company' ? (
            <>
              <Field
                htmlFor="companyName"
                label="Company name"
                required
                error={fieldError('companyName')}
              >
                <Input
                  id="companyName"
                  name="companyName"
                  defaultValue={defaults.companyName}
                  maxLength={160}
                  autoComplete="organization"
                  hasError={Boolean(fieldError('companyName'))}
                />
              </Field>

              <Field htmlFor="contactName" label="Contact person" error={fieldError('contactName')}>
                <Input
                  id="contactName"
                  name="contactName"
                  defaultValue={defaults.contactName}
                  maxLength={120}
                />
              </Field>

              <Field htmlFor="vatNumber" label="VAT number" error={fieldError('vatNumber')}>
                <Input id="vatNumber" name="vatNumber" defaultValue={defaults.vatNumber} maxLength={40} />
              </Field>

              <Field
                htmlFor="registrationNumber"
                label="Registration number"
                error={fieldError('registrationNumber')}
              >
                <Input
                  id="registrationNumber"
                  name="registrationNumber"
                  defaultValue={defaults.registrationNumber}
                  maxLength={60}
                />
              </Field>
            </>
          ) : (
            <>
              <Field htmlFor="firstName" label="First name" error={fieldError('firstName')}>
                <Input
                  id="firstName"
                  name="firstName"
                  defaultValue={defaults.firstName}
                  maxLength={80}
                  autoComplete="given-name"
                />
              </Field>

              <Field
                htmlFor="lastName"
                label="Last name"
                required
                error={fieldError('lastName')}
              >
                <Input
                  id="lastName"
                  name="lastName"
                  defaultValue={defaults.lastName}
                  maxLength={80}
                  autoComplete="family-name"
                  hasError={Boolean(fieldError('lastName'))}
                />
              </Field>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Contact details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="email" label="E-mail" error={fieldError('email')}>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={defaults.email}
              autoComplete="email"
              hasError={Boolean(fieldError('email'))}
            />
          </Field>

          <Field htmlFor="phone" label="Phone" error={fieldError('phone')}>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={defaults.phone}
              autoComplete="tel"
              hasError={Boolean(fieldError('phone'))}
            />
          </Field>

          <Field htmlFor="mobile" label="Mobile" error={fieldError('mobile')}>
            <Input id="mobile" name="mobile" type="tel" defaultValue={defaults.mobile} />
          </Field>

          <Field htmlFor="website" label="Website" error={fieldError('website')}>
            <Input
              id="website"
              name="website"
              defaultValue={defaults.website}
              placeholder="example.com"
              hasError={Boolean(fieldError('website'))}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Billing address</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            htmlFor="addressLine1"
            label="Address"
            className="sm:col-span-2"
            error={fieldError('addressLine1')}
          >
            <Input
              id="addressLine1"
              name="addressLine1"
              defaultValue={defaults.addressLine1}
              maxLength={160}
              autoComplete="address-line1"
            />
          </Field>

          <Field htmlFor="addressLine2" label="Address line 2" error={fieldError('addressLine2')}>
            <Input
              id="addressLine2"
              name="addressLine2"
              defaultValue={defaults.addressLine2}
              maxLength={160}
              autoComplete="address-line2"
            />
          </Field>

          <Field htmlFor="postalCode" label="Postal code" error={fieldError('postalCode')}>
            <Input
              id="postalCode"
              name="postalCode"
              defaultValue={defaults.postalCode}
              maxLength={20}
              autoComplete="postal-code"
            />
          </Field>

          <Field htmlFor="city" label="City" error={fieldError('city')}>
            <Input
              id="city"
              name="city"
              defaultValue={defaults.city}
              maxLength={80}
              autoComplete="address-level2"
            />
          </Field>

          <Field
            htmlFor="country"
            label="Country"
            hint="Two-letter country code, e.g. FR."
            error={fieldError('country')}
          >
            <Input
              id="country"
              name="country"
              defaultValue={defaults.country}
              maxLength={2}
              autoComplete="country"
              hasError={Boolean(fieldError('country'))}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Notes and tags</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field
            htmlFor="tags"
            label="Tags"
            hint="Comma separated, e.g. Premium, Contract, Emergency."
            error={fieldError('tags')}
          >
            <Input id="tags" name="tags" defaultValue={defaults.tags} maxLength={300} />
          </Field>

          <Field htmlFor="notes" label="Notes" error={fieldError('notes')}>
            <Textarea id="notes" name="notes" defaultValue={defaults.notes} rows={4} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link href={cancelHref} className={buttonClasses('outline', 'md')}>
          Cancel
        </Link>
        <SubmitButton pendingLabel="Saving…">
          {mode === 'create' ? 'Create customer' : 'Save changes'}
        </SubmitButton>
      </div>

    </form>
  );
}
