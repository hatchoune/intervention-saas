'use server';

import { revalidatePath } from 'next/cache';

import { requireOrganization, type SessionContext } from '@/lib/auth/session';
import { CUSTOMER_ENTITY_TYPE, getCustomerDependencies } from '@/lib/db/customers';
import { can } from '@/lib/domain/permissions';
import { actionError, actionSuccess, toActionError, type ActionState } from '@/lib/errors';
import { createSupabaseServerClient, type SupabaseServerClient } from '@/lib/supabase/server';
import { formDataToObject } from '@/lib/validation/common';
import {
  customerAddressIdSchema,
  customerAddressSchema,
  customerIdSchema,
  customerSchema,
  customerStatusChangeSchema,
  customerUpdateSchema,
  type CustomerInput,
} from '@/lib/validation/customer';
import type { Json } from '@/types/database';

/**
 * Server Actions for the Customers module.
 *
 * Customers are the root of the data model (interventions, quotes and invoices
 * reference them), so deletion is guarded: records with history are archived
 * instead of being removed.
 */

type Session = SessionContext & {
  organization: { id: string };
  role: 'admin' | 'manager' | 'technician';
};

function invalidate(customerId?: string): void {
  revalidatePath('/customers');
  revalidatePath('/interventions');
  revalidatePath('/quotes');
  revalidatePath('/invoices');
  revalidatePath('/dashboard');
  if (customerId) revalidatePath(`/customers/${customerId}`);
}

async function logActivity(
  supabase: SupabaseServerClient,
  session: Session,
  params: { entityId: string; entityLabel: string; summary: string; metadata?: Json },
): Promise<void> {
  // Fire-and-forget: an audit failure must never fail the user's mutation.
  const { error } = await supabase.rpc('log_activity', {
    p_organization_id: session.organization.id,
    p_action: 'updated',
    p_entity_type: CUSTOMER_ENTITY_TYPE,
    p_entity_id: params.entityId,
    p_entity_label: params.entityLabel,
    p_summary: params.summary,
    p_metadata: params.metadata ?? {},
  });

  if (error) console.error('[log_activity]', error.message);
}

async function requireManagerSession(): Promise<Session> {
  const session = await requireOrganization();
  if (!can('customers.manage', session.role)) throw new Error('insufficient_privileges');
  return session as Session;
}

/**
 * Maps the validated payload onto the `customers` columns. `name` is derived by
 * a database trigger, so it is deliberately absent here.
 */
function toColumns(input: CustomerInput) {
  return {
    type: input.type,
    status: input.status,
    first_name: input.firstName,
    last_name: input.lastName,
    company_name: input.companyName,
    contact_name: input.contactName,
    email: input.email,
    phone: input.phone,
    mobile: input.mobile,
    website: input.website,
    vat_number: input.vatNumber,
    registration_number: input.registrationNumber,
    address_line1: input.addressLine1,
    address_line2: input.addressLine2,
    postal_code: input.postalCode,
    city: input.city,
    country: input.country,
    notes: input.notes,
    tags: input.tags,
  };
}

export async function createCustomerAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = customerSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  try {
    const session = await requireManagerSession();
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('customers')
      .insert({
        organization_id: session.organization.id,
        // Required by the `customers_insert_manager` policy.
        created_by: session.user.id,
        ...toColumns(parsed.data),
      })
      .select('*')
      .single();

    if (error) return toActionError(error);

    await logActivity(supabase, session, {
      entityId: data.id,
      entityLabel: data.name,
      summary: `Customer ${data.name} created`,
    });

    invalidate(data.id);
  } catch (error) {
    return toActionError(error, 'We could not save this customer.');
  }

  return actionSuccess('Customer created.');
}

export async function updateCustomerAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = customerUpdateSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  try {
    const session = await requireManagerSession();
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from('customers')
      .update(toColumns(parsed.data))
      .eq('id', parsed.data.id)
      .eq('organization_id', session.organization.id);

    if (error) return toActionError(error);

    invalidate(parsed.data.id);
  } catch (error) {
    return toActionError(error, 'We could not save this customer.');
  }

  return actionSuccess('Customer updated.');
}

/** Archives (or reactivates) a customer without touching its history. */
export async function changeCustomerStatusAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = customerStatusChangeSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  try {
    const session = await requireManagerSession();
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from('customers')
      .update({ status: parsed.data.status })
      .eq('id', parsed.data.id)
      .eq('organization_id', session.organization.id);

    if (error) return toActionError(error);

    invalidate(parsed.data.id);
  } catch (error) {
    return toActionError(error, 'We could not update this customer.');
  }

  return actionSuccess(parsed.data.status === 'archived' ? 'Customer archived.' : 'Customer reactivated.');
}

/**
 * Hard-deletes a customer. Only allowed while nothing references it: invoices
 * must stay attached to the customer they were issued to, so a customer with any
 * document history has to be archived instead.
 */
export async function deleteCustomerAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = customerIdSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  try {
    const session = await requireManagerSession();
    const supabase = await createSupabaseServerClient();

    const dependencies = await getCustomerDependencies(session.organization.id, parsed.data.id);
    const total = dependencies.interventions + dependencies.quotes + dependencies.invoices;

    if (total > 0) {
      return actionError(
        'This customer has linked documents (' +
          `${dependencies.interventions} intervention(s), ${dependencies.quotes} quote(s), ` +
          `${dependencies.invoices} invoice(s)). Archive the customer instead of deleting it.`,
      );
    }

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', parsed.data.id)
      .eq('organization_id', session.organization.id);

    if (error) return toActionError(error);

    invalidate();
  } catch (error) {
    return toActionError(error, 'We could not delete this customer.');
  }

  return actionSuccess('Customer deleted.');
}

/**
 * Creates or updates a service address. When `isDefault` is set, every other
 * address of the customer is cleared in the same transaction-ish sequence
 * (the app-level rule mirrors the partial unique index on the table).
 */
export async function saveCustomerAddressAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = customerAddressSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  try {
    const session = await requireManagerSession();
    const supabase = await createSupabaseServerClient();

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name')
      .eq('organization_id', session.organization.id)
      .eq('id', parsed.data.customerId)
      .maybeSingle();

    if (customerError) return toActionError(customerError);
    if (!customer) return actionError('This customer no longer exists.');

    const values = {
      organization_id: session.organization.id,
      customer_id: customer.id,
      label: parsed.data.label,
      address_line1: parsed.data.addressLine1,
      address_line2: parsed.data.addressLine2,
      postal_code: parsed.data.postalCode,
      city: parsed.data.city,
      country: parsed.data.country,
      access_notes: parsed.data.accessNotes,
      is_default: parsed.data.isDefault,
    };

    if (parsed.data.isDefault) {
      // Only one default address per customer.
      const { error: resetError } = await supabase
        .from('customer_addresses')
        .update({ is_default: false })
        .eq('organization_id', session.organization.id)
        .eq('customer_id', customer.id)
        .neq('id', parsed.data.addressId ?? '00000000-0000-0000-0000-000000000000');

      if (resetError) return toActionError(resetError);
    }

    if (parsed.data.addressId) {
      const { error } = await supabase
        .from('customer_addresses')
        .update(values)
        .eq('id', parsed.data.addressId)
        .eq('organization_id', session.organization.id)
        .eq('customer_id', customer.id);

      if (error) return toActionError(error);
    } else {
      const { error } = await supabase.from('customer_addresses').insert(values);
      if (error) return toActionError(error);
    }

    await logActivity(supabase, session, {
      entityId: customer.id,
      entityLabel: customer.name,
      summary: parsed.data.addressId ? 'Service address updated' : 'Service address added',
    });

    revalidatePath(`/customers/${customer.id}`);
    revalidatePath('/interventions');
  } catch (error) {
    return toActionError(error, 'We could not save this address.');
  }

  return actionSuccess(parsed.data.addressId ? 'Address updated.' : 'Address added.');
}

export async function deleteCustomerAddressAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = customerAddressIdSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  try {
    const session = await requireManagerSession();
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from('customer_addresses')
      .delete()
      .eq('id', parsed.data.addressId)
      .eq('organization_id', session.organization.id)
      .eq('customer_id', parsed.data.customerId);

    if (error) return toActionError(error);

    revalidatePath(`/customers/${parsed.data.customerId}`);
  } catch (error) {
    return toActionError(error, 'We could not delete this address.');
  }

  return actionSuccess('Address deleted.');
}
