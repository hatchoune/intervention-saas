'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireOrganization, type SessionContext } from '@/lib/auth/session';
import { syncInvoiceItems } from '@/lib/db/document-items';
import { getInvoice } from '@/lib/db/invoices';
import { can } from '@/lib/domain/permissions';
import { INVOICE_STATUS_TRANSITIONS } from '@/lib/domain/status';
import { actionError, actionSuccess, toActionError, type ActionState } from '@/lib/errors';
import { createSupabaseServerClient, type SupabaseServerClient } from '@/lib/supabase/server';
import { formDataToObject } from '@/lib/validation/common';
import {
  invoiceFormSchema,
  invoiceFromInterventionSchema,
  invoiceIdSchema,
  invoicePaymentSchema,
  invoiceStatusSchema,
  type InvoiceFormInput,
} from '@/lib/validation/document';
import type { Json, InvoiceStatus } from '@/types/database';

/**
 * Server Actions for the Invoices module.
 *
 * The database owns the money and the lifecycle: totals and the invoice number
 * come from triggers, and `sync_invoice_payment_state` derives `paid`/`partial`
 * from `amount_paid`. Consequently this layer never writes a "paid" status by
 * hand — payments go through `amountPaid`, and manual transitions are limited
 * to the moves a trigger keeps stable (draft → sent, → cancelled).
 */

type Session = SessionContext & {
  organization: { id: string; currency: string };
  role: 'admin' | 'manager' | 'technician';
};

const INVOICE_ENTITY_TYPE = 'invoice';

/**
 * Legal status moves for an invoice *from the app*. `partial`/`paid`/`overdue`
 * are derived by the database or the nightly sweep and are therefore absent:
 * setting them by hand would be reverted by the payment trigger.
 */
const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = INVOICE_STATUS_TRANSITIONS;

function invalidate(invoiceId?: string): void {
  revalidatePath('/invoices');
  revalidatePath('/quotes');
  revalidatePath('/interventions');
  revalidatePath('/customers');
  revalidatePath('/dashboard');
  if (invoiceId) revalidatePath(`/invoices/${invoiceId}`);
}

async function logActivity(
  supabase: SupabaseServerClient,
  session: Session,
  params: {
    entityId: string;
    entityLabel: string;
    summary: string;
    action?: 'created' | 'updated' | 'deleted' | 'status_changed';
    metadata?: Json;
  },
): Promise<void> {
  // Fire-and-forget: an audit failure must never fail the user's mutation.
  const { error } = await supabase.rpc('log_activity', {
    p_organization_id: session.organization.id,
    p_action: params.action ?? 'updated',
    p_entity_type: INVOICE_ENTITY_TYPE,
    p_entity_id: params.entityId,
    p_entity_label: params.entityLabel,
    p_summary: params.summary,
    p_metadata: params.metadata ?? {},
  });

  if (error) console.error('[log_activity]', error.message);
}

async function requireBillingSession(): Promise<Session> {
  const session = await requireOrganization();
  if (!can('invoices.manage', session.role)) throw new Error('insufficient_privileges');
  return session as Session;
}

/** Header columns shared by create and update (`amount_paid` excluded on purpose). */
function headerOf(input: InvoiceFormInput) {
  return {
    customer_id: input.customerId,
    intervention_id: input.interventionId,
    status: input.status,
    issue_date: input.issueDate,
    due_date: input.dueDate,
    discount_type: input.discountType,
    discount_value: input.discountValue,
    notes: input.notes,
    internal_notes: input.internalNotes,
    payment_terms: input.paymentTerms,
    payment_method: input.paymentMethod,
    // Safe to write: the payment trigger re-derives `status` (and `paid_at`)
    // from this value, so form and database can never disagree.
    amount_paid: input.amountPaid,
  };
}
export async function createInvoiceAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = invoiceFormSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  let invoiceId: string | null = null;

  try {
    const session = await requireBillingSession();
    const supabase = await createSupabaseServerClient();

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name')
      .eq('organization_id', session.organization.id)
      .eq('id', parsed.data.customerId)
      .maybeSingle();

    if (customerError) return toActionError(customerError);
    if (!customer) return actionError('This customer no longer exists.');

    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert({
        organization_id: session.organization.id,
        currency: session.organization.currency,
        created_by: session.user.id,
        updated_by: session.user.id,
        ...headerOf(parsed.data),
      })
      .select('*')
      .single();

    if (error) return toActionError(error);

    invoiceId = invoice.id;

    const sync = await syncInvoiceItems(
      supabase,
      session.organization.id,
      invoice.id,
      parsed.data.lines,
    );

    if (sync.error) return toActionError(sync.error);

    await logActivity(supabase, session, {
      entityId: invoice.id,
      entityLabel: invoice.invoice_number,
      summary: `Invoice ${invoice.invoice_number} created for ${customer.name}`,
      action: 'created',
    });

    invalidate(invoice.id);
  } catch (error) {
    return toActionError(error, 'We could not create this invoice.');
  }

  redirect(`/invoices/${invoiceId}`);
}

export async function updateInvoiceAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = invoiceFormSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  const invoiceId = String(formData.get('id') ?? '');
  const idCheck = invoiceIdSchema.safeParse({ invoiceId });
  if (!idCheck.success) return toActionError(idCheck.error);

  try {
    const session = await requireBillingSession();
    const supabase = await createSupabaseServerClient();

    const existing = await getInvoice(session.organization.id, invoiceId);
    if (!existing) return actionError('This invoice no longer exists.');

    // Once an invoice has left the draft stage its commercial content is fixed.
    if (existing.status !== 'draft') {
      return actionError(
        'Only a draft invoice can be edited. Duplicate it if you need changes.',
      );
    }

    const { error } = await supabase
      .from('invoices')
      .update({ ...headerOf(parsed.data), updated_by: session.user.id })
      .eq('id', existing.id)
      .eq('organization_id', session.organization.id);

    if (error) return toActionError(error);

    const sync = await syncInvoiceItems(
      supabase,
      session.organization.id,
      existing.id,
      parsed.data.lines,
    );

    if (sync.error) return toActionError(sync.error);

    await logActivity(supabase, session, {
      entityId: existing.id,
      entityLabel: existing.invoice_number,
      summary: `Invoice ${existing.invoice_number} updated`,
    });

    invalidate(existing.id);
  } catch (error) {
    return toActionError(error, 'We could not save this invoice.');
  }

  return actionSuccess('Invoice saved.');
}
export async function deleteInvoiceAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = invoiceIdSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  try {
    const session = await requireBillingSession();
    const supabase = await createSupabaseServerClient();

    const existing = await getInvoice(session.organization.id, parsed.data.invoiceId);
    if (!existing) return actionError('This invoice no longer exists.');

    if (existing.status !== 'draft') {
      return actionError('Only a draft invoice can be deleted. Cancel it instead.');
    }

    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', existing.id)
      .eq('organization_id', session.organization.id);

    if (error) return toActionError(error);

    await logActivity(supabase, session, {
      entityId: existing.id,
      entityLabel: existing.invoice_number,
      summary: `Invoice ${existing.invoice_number} deleted`,
      action: 'deleted',
    });

    invalidate();
  } catch (error) {
    return toActionError(error, 'We could not delete this invoice.');
  }

  return actionSuccess('Invoice deleted.');
}

export async function changeInvoiceStatusAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = formDataToObject(formData);
  const idCheck = invoiceIdSchema.safeParse(raw);
  if (!idCheck.success) return toActionError(idCheck.error);

  const statusCheck = invoiceStatusSchema.safeParse(raw.status);
  if (!statusCheck.success) return toActionError(statusCheck.error);

  try {
    const session = await requireBillingSession();
    const supabase = await createSupabaseServerClient();

    const existing = await getInvoice(session.organization.id, idCheck.data.invoiceId);
    if (!existing) return actionError('This invoice no longer exists.');

    if (!INVOICE_TRANSITIONS[existing.status].includes(statusCheck.data)) {
      return actionError(
        `A ${existing.status} invoice cannot move to ${statusCheck.data}.`,
      );
    }

    const { error } = await supabase
      .from('invoices')
      .update({ status: statusCheck.data, updated_by: session.user.id })
      .eq('id', existing.id)
      .eq('organization_id', session.organization.id);

    if (error) return toActionError(error);

    await logActivity(supabase, session, {
      entityId: existing.id,
      entityLabel: existing.invoice_number,
      summary: `Invoice ${existing.invoice_number} marked as ${statusCheck.data}`,
      action: 'status_changed',
      metadata: { from: existing.status, to: statusCheck.data },
    });

    invalidate(existing.id);
  } catch (error) {
    return toActionError(error, 'We could not update this invoice.');
  }

  return actionSuccess('Invoice updated.');
}
/**
 * Records a payment by writing the *absolute* `amount_paid` value. The
 * `sync_invoice_payment_state` trigger turns it into `partial`/`paid`
 * (and stamps `paid_at`), so status never drifts from the money columns.
 */
export async function recordInvoicePaymentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = invoicePaymentSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  try {
    const session = await requireBillingSession();
    const supabase = await createSupabaseServerClient();

    const existing = await getInvoice(session.organization.id, parsed.data.invoiceId);
    if (!existing) return actionError('This invoice no longer exists.');

    if (existing.status === 'draft') {
      return actionError('Send the invoice before recording a payment.');
    }

    if (existing.status === 'cancelled') {
      return actionError('A cancelled invoice cannot receive payments.');
    }

    const total = Number(existing.total);
    if (parsed.data.amountPaid > total) {
      return actionError('The payment cannot exceed the invoice total.');
    }

    const { error } = await supabase
      .from('invoices')
      .update({
        amount_paid: parsed.data.amountPaid,
        payment_method: parsed.data.paymentMethod,
        updated_by: session.user.id,
      })
      .eq('id', existing.id)
      .eq('organization_id', session.organization.id);

    if (error) return toActionError(error);

    // Read back the trigger-derived state for an accurate audit entry.
    const refreshed = await getInvoice(session.organization.id, existing.id);

    await logActivity(supabase, session, {
      entityId: existing.id,
      entityLabel: existing.invoice_number,
      summary: `Payment of ${parsed.data.amountPaid.toFixed(2)} recorded on ${existing.invoice_number}`,
      action: 'status_changed',
      metadata: {
        amount_paid: parsed.data.amountPaid,
        status: refreshed?.status ?? existing.status,
      },
    });

    invalidate(existing.id);
  } catch (error) {
    return toActionError(error, 'We could not record this payment.');
  }

  return actionSuccess('Payment recorded.');
}

/**
 * Creates a draft invoice for a completed intervention. When the intervention
 * has an accepted, unconverted quote, the database bills that quote instead
 * (lines, discounts and all) — otherwise it creates a single flat-rate line.
 */
export async function createInvoiceFromInterventionAction(
  _previous: ActionState<{ invoiceId: string }>,
  formData: FormData,
): Promise<ActionState<{ invoiceId: string }>> {
  type Data = { invoiceId: string };
  const parsed = invoiceFromInterventionSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error) as ActionState<Data>;

  const interventionId = parsed.data.interventionId;
  let invoiceId: string | null = null;

  try {
    const session = await requireBillingSession();
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.rpc('create_invoice_from_intervention', {
      p_intervention_id: interventionId,
      p_issue_date: parsed.data.issueDate,
      p_due_date: parsed.data.dueDate,
    });

    if (error) return toActionError(error) as ActionState<Data>;
    if (!data) return actionError('The invoice could not be created.') as ActionState<Data>;

    invoiceId = data;

    const invoice = await getInvoice(session.organization.id, data);

    await logActivity(supabase, session, {
      entityId: data,
      entityLabel: invoice?.invoice_number ?? 'Invoice',
      summary: `Invoice ${invoice?.invoice_number ?? ''} generated from an intervention`,
      action: 'created',
      metadata: { intervention_id: interventionId },
    });

    invalidate(data);
    revalidatePath('/interventions');
  } catch (error) {
    return toActionError(error, 'We could not generate the invoice.') as ActionState<Data>;
  }

  redirect(`/invoices/${invoiceId}`);
}
