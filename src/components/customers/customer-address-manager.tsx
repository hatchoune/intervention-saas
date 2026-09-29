'use client';

import { useActionState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';

import { ActionAlert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/controls';
import { DangerSubmitButton, Modal } from '@/components/ui/modal';
import { SubmitButton } from '@/components/ui/submit-button';
import {
  deleteCustomerAddressAction,
  saveCustomerAddressAction,
} from '@/lib/actions/customers';
import { IDLE_ACTION_STATE } from '@/lib/errors';
import type { CustomerAddressRow } from '@/types/database';

/**
 * Service addresses of a customer.
 *
 * Addresses are edited in a native `<dialog>` (focus trap, Escape and backdrop
 * handling come from the platform) and submitted through the same server action
 * for both create and edit — the presence of `addressId` decides which.
 */

function AddressForm({
  customerId,
  address,
  onDone,
}: {
  customerId: string;
  address?: CustomerAddressRow;
  onDone?: () => void;
}) {
  const [state, formAction] = useActionState(saveCustomerAddressAction, IDLE_ACTION_STATE);
  const fieldError = (field: string): string | undefined => state.fieldErrors?.[field]?.[0];

  return (
    <form action={formAction} className="space-y-4" id={`address-form-${address?.id ?? 'new'}`}>
      <input type="hidden" name="customerId" value={customerId} />
      {address ? <input type="hidden" name="addressId" value={address.id} /> : null}

      <ActionAlert status={state.status} message={state.message} />

      <Field htmlFor={`label-${address?.id ?? 'new'}`} label="Label" error={fieldError('label')}>
        <Input
          id={`label-${address?.id ?? 'new'}`}
          name="label"
          defaultValue={address?.label ?? 'Main site'}
          maxLength={80}
        />
      </Field>

      <Field
        htmlFor={`addressLine1-${address?.id ?? 'new'}`}
        label="Address"
        required
        error={fieldError('addressLine1')}
      >
        <Input
          id={`addressLine1-${address?.id ?? 'new'}`}
          name="addressLine1"
          defaultValue={address?.address_line1 ?? ''}
          maxLength={160}
          hasError={Boolean(fieldError('addressLine1'))}
        />
      </Field>

      <Field htmlFor={`addressLine2-${address?.id ?? 'new'}`} label="Address line 2">
        <Input
          id={`addressLine2-${address?.id ?? 'new'}`}
          name="addressLine2"
          defaultValue={address?.address_line2 ?? ''}
          maxLength={160}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field htmlFor={`postalCode-${address?.id ?? 'new'}`} label="Postal code">
          <Input
            id={`postalCode-${address?.id ?? 'new'}`}
            name="postalCode"
            defaultValue={address?.postal_code ?? ''}
            maxLength={20}
          />
        </Field>

        <Field htmlFor={`city-${address?.id ?? 'new'}`} label="City">
          <Input
            id={`city-${address?.id ?? 'new'}`}
            name="city"
            defaultValue={address?.city ?? ''}
            maxLength={80}
          />
        </Field>

        <Field htmlFor={`country-${address?.id ?? 'new'}`} label="Country">
          <Input
            id={`country-${address?.id ?? 'new'}`}
            name="country"
            defaultValue={address?.country ?? 'FR'}
            maxLength={2}
          />
        </Field>
      </div>

      <Field htmlFor={`accessNotes-${address?.id ?? 'new'}`} label="Access notes">
        <Textarea
          id={`accessNotes-${address?.id ?? 'new'}`}
          name="accessNotes"
          defaultValue={address?.access_notes ?? ''}
          rows={2}
          placeholder="Gate code, parking, pets…"
        />
      </Field>

      <Checkbox
        id={`isDefault-${address?.id ?? 'new'}`}
        name="isDefault"
        label="Default service address"
        defaultChecked={address?.is_default ?? false}
      />

      <div className="flex justify-end gap-2">
        {onDone ? (
          <Button type="button" variant="outline" onClick={onDone}>
            Close
          </Button>
        ) : null}
        <SubmitButton pendingLabel="Saving…">{address ? 'Save address' : 'Add address'}</SubmitButton>
      </div>
    </form>
  );
}

function DeleteAddressAction({ customerId, addressId }: { customerId: string; addressId: string }) {
  const [state, formAction] = useActionState(deleteCustomerAddressAction, IDLE_ACTION_STATE);

  return (
    <form action={formAction} className="inline-flex">
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="addressId" value={addressId} />
      <DangerSubmitButton
        confirmMessage="Delete this service address?"
        className="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
        aria-label="Delete address"
        title={state.status === 'error' ? state.message : 'Delete address'}
      >
        <Trash2 aria-hidden className="size-3.5" />
      </DangerSubmitButton>
    </form>
  );
}

export function CustomerAddressManager({
  customerId,
  addresses,
  canManage,
}: {
  customerId: string;
  addresses: CustomerAddressRow[];
  canManage: boolean;
}) {
  return (
    <div className="space-y-4">
      {addresses.length === 0 ? (
        <p className="text-sm text-slate-500">
          No service address yet. Interventions fall back to the billing address.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {addresses.map((address) => (
            <li key={address.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  {address.label}
                  {address.is_default ? <Badge tone="accent">Default</Badge> : null}
                </p>
                <address className="mt-0.5 text-sm not-italic text-slate-600">
                  {address.address_line1}
                  {address.address_line2 ? `, ${address.address_line2}` : ''}
                  {address.postal_code || address.city
                    ? ` · ${[address.postal_code, address.city].filter(Boolean).join(' ')}`
                    : ''}
                  {address.country ? ` · ${address.country}` : ''}
                </address>
                {address.access_notes ? (
                  <p className="mt-0.5 text-xs text-slate-500">{address.access_notes}</p>
                ) : null}
              </div>

              {canManage ? (
                <div className="flex items-center gap-1">
                  <Modal
                    trigger={
                      <Button variant="ghost" size="sm" aria-label={`Edit ${address.label}`}>
                        <Pencil aria-hidden className="size-3.5" />
                        Edit
                      </Button>
                    }
                    title={address.label}
                    description="Update the service address details."
                  >
                    <AddressForm customerId={customerId} address={address} />
                  </Modal>
                  <DeleteAddressAction customerId={customerId} addressId={address.id} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <Modal
          trigger={
            <Button variant="outline" size="sm">
              <Plus aria-hidden className="size-4" />
              Add a service address
            </Button>
          }
          title="New service address"
          description="Where the intervention actually takes place."
        >
          <AddressForm customerId={customerId} />
        </Modal>
      ) : null}
    </div>
  );
}
