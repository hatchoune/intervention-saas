'use client';

import Link from 'next/link';
import { useActionState, useMemo, useState } from 'react';

import { ActionAlert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/controls';
import { SubmitButton } from '@/components/ui/submit-button';
import { createInterventionAction, updateInterventionAction } from '@/lib/actions/interventions';
import type { CustomerOption, TechnicianOption } from '@/lib/db/interventions';
import {
  INTERVENTION_PRIORITIES,
  INTERVENTION_PRIORITY_META,
  INTERVENTION_STATUS_META,
} from '@/lib/domain/status';
import { IDLE_ACTION_STATE } from '@/lib/errors';
import { toDateTimeInputValue } from '@/lib/utils/format';
import type {
  CustomerAddressRow,
  InterventionPriority,
  InterventionStatus,
} from '@/types/database';

/**
 * Create / edit form for an intervention.
 *
 * The customer list is filtered client side (no extra dependency, no round
 * trip) and choosing a customer loads that customer's saved addresses, which
 * pre-fill the address snapshot stored on the intervention.
 */

export interface InterventionFormDefaults {
  id: string | null;
  customerId: string;
  customerAddressId: string;
  technicianId: string;
  title: string;
  description: string;
  internalNotes: string;
  status: InterventionStatus;
  priority: InterventionPriority;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  country: string;
}

export interface InterventionFormProps {
  mode: 'create' | 'update';
  customers: CustomerOption[];
  addresses: CustomerAddressRow[];
  technicians: TechnicianOption[];
  defaults: InterventionFormDefaults;
  /** Statuses the current user may move this record to. */
  allowedStatuses: InterventionStatus[];
  canEditInternalNotes: boolean;
  cancelHref: string;
}

export function InterventionForm({
  mode,
  customers,
  addresses,
  technicians,
  defaults,
  allowedStatuses,
  canEditInternalNotes,
  cancelHref,
}: InterventionFormProps) {
  const [state, formAction] = useActionState(
    mode === 'create' ? createInterventionAction : updateInterventionAction,
    IDLE_ACTION_STATE,
  );

  const [customerQuery, setCustomerQuery] = useState('');
  const [customerId, setCustomerId] = useState(defaults.customerId);
  const [addressId, setAddressId] = useState(defaults.customerAddressId);
  const [snapshot, setSnapshot] = useState({
    addressLine1: defaults.addressLine1,
    addressLine2: defaults.addressLine2,
    postalCode: defaults.postalCode,
    city: defaults.city,
    country: defaults.country || 'FR',
  });

  const visibleCustomers = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(query) ||
        (customer.email ?? '').toLowerCase().includes(query),
    );
  }, [customerQuery, customers]);

  const customerAddresses = useMemo(
    () => addresses.filter((address) => address.customer_id === customerId),
    [addresses, customerId],
  );

  function applyAddress(address: CustomerAddressRow) {
    setSnapshot({
      addressLine1: address.address_line1,
      addressLine2: address.address_line2 ?? '',
      postalCode: address.postal_code ?? '',
      city: address.city ?? '',
      country: address.country ?? 'FR',
    });
  }

  function applyCustomerPrimaryAddress(nextCustomerId: string) {
    const customer = customers.find((item) => item.id === nextCustomerId);
    if (!customer) return;
    setSnapshot({
      addressLine1: customer.address_line1 ?? '',
      addressLine2: customer.address_line2 ?? '',
      postalCode: customer.postal_code ?? '',
      city: customer.city ?? '',
      country: customer.country ?? 'FR',
    });
  }

  function handleCustomerChange(nextCustomerId: string) {
    setCustomerId(nextCustomerId);

    const customerSites = addresses.filter((address) => address.customer_id === nextCustomerId);
    const preferred = customerSites.find((address) => address.is_default) ?? customerSites[0] ?? null;

    setAddressId(preferred?.id ?? '');

    if (preferred) applyAddress(preferred);
    else applyCustomerPrimaryAddress(nextCustomerId);
  }

  function handleAddressChange(nextAddressId: string) {
    setAddressId(nextAddressId);

    const address = addresses.find((item) => item.id === nextAddressId);
    if (address) applyAddress(address);
  }

  const fieldError = (field: string): string | undefined => state.fieldErrors?.[field]?.[0];

  return (
    <form action={formAction} className="space-y-6">
      <ActionAlert status={state.status} message={state.message} />

      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <Card>
        <CardHeader>
          <CardTitle as="h2">Assignment</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            htmlFor="customer-search"
            label="Find a customer"
            hint="Filters the list below. Leave empty to see every customer."
          >
            <Input
              id="customer-search"
              type="search"
              value={customerQuery}
              onChange={(event) => setCustomerQuery(event.target.value)}
              placeholder="Search by name or e-mail"
            />
          </Field>

          <Field htmlFor="customerId" label="Customer" required error={fieldError('customerId')}>
            <Select
              id="customerId"
              name="customerId"
              required
              hasError={Boolean(fieldError('customerId'))}
              value={customerId}
              onChange={(event) => handleCustomerChange(event.target.value)}
            >
              <option value="">Select a customer…</option>
              {visibleCustomers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            htmlFor="customerAddressId"
            label="Service address"
            hint="Pre-fills the address below. Saving requires the address to belong to the customer."
            error={fieldError('customerAddressId')}
          >
            <Select
              id="customerAddressId"
              name="customerAddressId"
              hasError={Boolean(fieldError('customerAddressId'))}
              value={addressId}
              onChange={(event) => handleAddressChange(event.target.value)}
            >
              <option value="">Customer main address</option>
              {customerAddresses.map((address) => (
                <option key={address.id} value={address.id}>
                  {address.label} — {address.address_line1}
                  {address.city ? `, ${address.city}` : ''}
                </option>
              ))}
            </Select>
          </Field>

          <Field htmlFor="technicianId" label="Technician" error={fieldError('technicianId')}>
            <Select
              id="technicianId"
              name="technicianId"
              defaultValue={defaults.technicianId}
              hasError={Boolean(fieldError('technicianId'))}
            >
              <option value="">Unassigned</option>
              {technicians.map((technician) => (
                <option key={technician.id} value={technician.id}>
                  {technician.full_name}
                </option>
              ))}
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Job details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            htmlFor="title"
            label="Title"
            required
            className="sm:col-span-2"
            error={fieldError('title')}
          >
            <Input
              id="title"
              name="title"
              defaultValue={defaults.title}
              required
              maxLength={160}
              hasError={Boolean(fieldError('title'))}
              placeholder="Replace the boiler in kitchen 2"
            />
          </Field>

          <Field htmlFor="description" label="Description" error={fieldError('description')}>
            <Textarea
              id="description"
              name="description"
              defaultValue={defaults.description}
              hasError={Boolean(fieldError('description'))}
            />
          </Field>

          <Field
            htmlFor="internalNotes"
            label="Internal notes"
            hint={canEditInternalNotes ? 'Never shown to the customer.' : 'Only managers can edit internal notes.'}
            error={fieldError('internalNotes')}
          >
            {canEditInternalNotes ? (
              <Textarea id="internalNotes" name="internalNotes" defaultValue={defaults.internalNotes} />
            ) : (
              <>
                <input id="internalNotes" type="hidden" name="internalNotes" value={defaults.internalNotes} />
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm whitespace-pre-wrap text-slate-600">
                  {defaults.internalNotes || 'No internal notes.'}
                </p>
              </>
            )}
          </Field>

          <Field htmlFor="status" label="Status" error={fieldError('status')}>
            <Select
              id="status"
              name="status"
              defaultValue={defaults.status}
              hasError={Boolean(fieldError('status'))}
            >
              {allowedStatuses.map((status) => (
                <option key={status} value={status}>
                  {INTERVENTION_STATUS_META[status].label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            htmlFor="priority"
            label="Priority"
            hint={INTERVENTION_PRIORITY_META[defaults.priority].description}
            error={fieldError('priority')}
          >
            <Select
              id="priority"
              name="priority"
              defaultValue={defaults.priority}
              hasError={Boolean(fieldError('priority'))}
            >
              {INTERVENTION_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {INTERVENTION_PRIORITY_META[priority].label}
                </option>
              ))}
            </Select>
          </Field>

          <Field htmlFor="scheduledStart" label="Scheduled start" error={fieldError('scheduledStart')}>
            <Input
              id="scheduledStart"
              name="scheduledStart"
              type="datetime-local"
              defaultValue={toDateTimeInputValue(defaults.scheduledStart)}
              hasError={Boolean(fieldError('scheduledStart'))}
            />
          </Field>

          <Field
            htmlFor="scheduledEnd"
            label="Scheduled end"
            error={fieldError('scheduledEnd')}
          >
            <Input
              id="scheduledEnd"
              name="scheduledEnd"
              type="datetime-local"
              defaultValue={toDateTimeInputValue(defaults.scheduledEnd)}
              hasError={Boolean(fieldError('scheduledEnd'))}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Address snapshot</CardTitle>
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
              maxLength={160}
              value={snapshot.addressLine1}
              onChange={(event) => setSnapshot({ ...snapshot, addressLine1: event.target.value })}
            />
          </Field>

          <Field htmlFor="addressLine2" label="Address line 2" error={fieldError('addressLine2')}>
            <Input
              id="addressLine2"
              name="addressLine2"
              maxLength={160}
              value={snapshot.addressLine2}
              onChange={(event) => setSnapshot({ ...snapshot, addressLine2: event.target.value })}
            />
          </Field>

          <Field htmlFor="postalCode" label="Postal code" error={fieldError('postalCode')}>
            <Input
              id="postalCode"
              name="postalCode"
              maxLength={20}
              value={snapshot.postalCode}
              onChange={(event) => setSnapshot({ ...snapshot, postalCode: event.target.value })}
            />
          </Field>

          <Field htmlFor="city" label="City" error={fieldError('city')}>
            <Input
              id="city"
              name="city"
              maxLength={80}
              value={snapshot.city}
              onChange={(event) => setSnapshot({ ...snapshot, city: event.target.value })}
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
              maxLength={2}
              value={snapshot.country}
              onChange={(event) =>
                setSnapshot({ ...snapshot, country: event.target.value.toUpperCase() })
              }
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link href={cancelHref} className={buttonClasses('outline', 'md')}>
          Cancel
        </Link>
        <SubmitButton pendingLabel="Saving…">
          {mode === 'create' ? 'Create intervention' : 'Save changes'}
        </SubmitButton>
      </div>
    </form>
  );
}
