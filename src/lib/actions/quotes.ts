'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireOrganization, type SessionContext } from '@/lib/auth/session';
import { syncQuoteItems } from '@/lib/db/document-items';
import { getQuote } from '@/lib/db/quotes';
import { can } from '@/lib/domain/permissions';
import { QUOTE_STATUS_TRANSITIONS } from '@/lib/domain/status';
import { actionError, actionSuccess, toActionError, type ActionState } from '@/lib/errors';
import { createSupabaseServerClient, type SupabaseServerClient } from '@/lib/supabase/server';
import { formDataToObject } from '@/lib/validation/common';
import {
  quoteFormSchema,
  quoteIdSchema,
  quoteStatusSchema,
  type QuoteFormInput,
} from '@/lib/validation/document';
import type { Json, QuoteStatus } from '@/types/database';

/**
 * Server Actions for the Quotes module.
 *
 * Totals, `quote_number` and the lifecycle timestamps are produced by the
 * database (triggers + `next_document_number`), so this layer only writes the
 * commercial inputs: header fields, lines and status.
 */

type Session = SessionContext & {
  organization: { id: string; currency: string };
  role: 'admin' | 'manager' | 'technician';
};

const QUOTE_ENTITY_TYPE = 'quote';

/** Legal status moves for a quote — single source of truth in the domain layer. */
const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = QUOTE_STATUS_TRANSITIONS;

function invalidate(quoteId?: string): void {
  revalidatePath('/quotes');
  revalidatePath('/invoices');
  revalidatePath('/customers');
  revalidatePath('/dashboard');
  if (quoteId) revalidatePath(`/quotes/${quoteId}`);
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
    p_entity_type: QUOTE_ENTITY_TYPE,
    p_entity_id: params.entityId,
    p_entity_label: params.entityLabel,
    p_summary: params.summary,
    p_metadata: params.metadata ?? {},
  });

  if (error) console.error('[log_activity]', error.message);
}

async function requireBillingSession(): Promise<Session> {
  const session = await requireOrganization();
  if (!can('quotes.manage', session.role)) throw new Error('insufficient_privileges');
  return session as Session;
}

/** Header columns shared by create and update. */
function headerOf(input: QuoteFormInput) {
  return {
    customer_id: input.customerId,
    intervention_id: input.interventionId,
    status: input.status,
    issue_date: input.issueDate,
    valid_until: input.validUntil,
    discount_type: input.discountType,
    discount_value: input.discountValue,
    notes: input.notes,
    internal_notes: input.internalNotes,
  };
}

export async function createQuoteAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = quoteFormSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  let quoteId: string | null = null;

  try {
    const session = await requireBillingSession();
    const supabase = await createSupabaseServerClient();

    // The customer must belong to this organisation (RLS would also block it,
    // but the check gives a clear message instead of an empty result).
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name')
      .eq('organization_id', session.organization.id)
      .eq('id', parsed.data.customerId)
      .maybeSingle();

    if (customerError) return toActionError(customerError);
    if (!customer) return actionError('This customer no longer exists.');

    const { data: quote, error } = await supabase
      .from('quotes')
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

    quoteId = quote.id;

    const sync = await syncQuoteItems(
      supabase,
      session.organization.id,
      quote.id,
      parsed.data.lines,
    );

    if (sync.error) return toActionError(sync.error);

    await logActivity(supabase, session, {
      entityId: quote.id,
      entityLabel: quote.quote_number,
      summary: `Quote ${quote.quote_number} created for ${customer.name}`,
      action: 'created',
    });

    invalidate(quote.id);
  } catch (error) {
    return toActionError(error, 'We could not create this quote.');
  }

  redirect(`/quotes/${quoteId}`);
}

export async function updateQuoteAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = quoteFormSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  const quoteId = String(formData.get('id') ?? '');
  const idCheck = quoteIdSchema.safeParse({ quoteId });
  if (!idCheck.success) return toActionError(idCheck.error);

  try {
    const session = await requireBillingSession();
    const supabase = await createSupabaseServerClient();

    const existing = await getQuote(session.organization.id, quoteId);
    if (!existing) return actionError('This quote no longer exists.');

    // Accepted quotes have been signed by the customer: their lines are frozen.
    if (existing.status === 'accepted') {
      return actionError('An accepted quote cannot be edited. Duplicate it instead.');
    }

    const { error } = await supabase
      .from('quotes')
      .update({ ...headerOf(parsed.data), updated_by: session.user.id })
      .eq('id', existing.id)
      .eq('organization_id', session.organization.id);

    if (error) return toActionError(error);

    const sync = await syncQuoteItems(
      supabase,
      session.organization.id,
      existing.id,
      parsed.data.lines,
    );

    if (sync.error) return toActionError(sync.error);

    await logActivity(supabase, session, {
      entityId: existing.id,
      entityLabel: existing.quote_number,
      summary: `Quote ${existing.quote_number} updated`,
    });

    invalidate(existing.id);
  } catch (error) {
    return toActionError(error, 'We could not save this quote.');
  }

  return actionSuccess('Quote saved.');
}
export async function deleteQuoteAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = quoteIdSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  try {
    const session = await requireBillingSession();
    const supabase = await createSupabaseServerClient();

    const existing = await getQuote(session.organization.id, parsed.data.quoteId);
    if (!existing) return actionError('This quote no longer exists.');

    if (existing.status !== 'draft') {
      return actionError('Only a draft quote can be deleted. Mark it as rejected instead.');
    }

    const { error } = await supabase
      .from('quotes')
      .delete()
      .eq('id', existing.id)
      .eq('organization_id', session.organization.id);

    if (error) return toActionError(error);

    await logActivity(supabase, session, {
      entityId: existing.id,
      entityLabel: existing.quote_number,
      summary: `Quote ${existing.quote_number} deleted`,
      action: 'deleted',
    });

    invalidate();
  } catch (error) {
    return toActionError(error, 'We could not delete this quote.');
  }

  return actionSuccess('Quote deleted.');
}

export async function changeQuoteStatusAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = formDataToObject(formData);
  const idCheck = quoteIdSchema.safeParse(raw);
  if (!idCheck.success) return toActionError(idCheck.error);

  const statusCheck = quoteStatusSchema.safeParse(raw.status);
  if (!statusCheck.success) return toActionError(statusCheck.error);

  try {
    const session = await requireBillingSession();
    const supabase = await createSupabaseServerClient();

    const existing = await getQuote(session.organization.id, idCheck.data.quoteId);
    if (!existing) return actionError('This quote no longer exists.');

    if (!QUOTE_TRANSITIONS[existing.status].includes(statusCheck.data)) {
      return actionError(
        `A ${existing.status} quote cannot move to ${statusCheck.data}.`,
      );
    }

    const { error } = await supabase
      .from('quotes')
      .update({ status: statusCheck.data, updated_by: session.user.id })
      .eq('id', existing.id)
      .eq('organization_id', session.organization.id);

    if (error) return toActionError(error);

    await logActivity(supabase, session, {
      entityId: existing.id,
      entityLabel: existing.quote_number,
      summary: `Quote ${existing.quote_number} marked as ${statusCheck.data}`,
      action: 'status_changed',
      metadata: { from: existing.status, to: statusCheck.data },
    });

    invalidate(existing.id);
  } catch (error) {
    return toActionError(error, 'We could not update this quote.');
  }

  return actionSuccess('Quote updated.');
}
/**
 * Converts an accepted quote into a draft invoice through the SECURITY DEFINER
 * function, so the header, the copied lines and the invoice number are produced
 * in a single transaction.
 */
export async function convertQuoteToInvoiceAction(
  _previous: ActionState<{ invoiceId: string }>,
  formData: FormData,
): Promise<ActionState<{ invoiceId: string }>> {
  type Data = { invoiceId: string };
  const parsed = quoteIdSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error) as ActionState<Data>;

  let invoiceId: string | null = null;

  try {
    const session = await requireBillingSession();
    const supabase = await createSupabaseServerClient();

    // The RPC itself does not guard against a second conversion, so the app
    // does: one accepted quote must never produce two invoices.
    const quote = await getQuote(session.organization.id, parsed.data.quoteId);
    if (!quote) return actionError('This quote no longer exists.') as ActionState<Data>;
    if (quote.converted_invoice_id) {
      return actionError('This quote has already been invoiced.') as ActionState<Data>;
    }

    const { data, error } = await supabase.rpc('create_invoice_from_quote', {
      p_quote_id: parsed.data.quoteId,
      p_issue_date: null,
      p_due_date: null,
    });

    if (error) return toActionError(error) as ActionState<Data>;
    if (!data) return actionError('The invoice could not be created.') as ActionState<Data>;

    invoiceId = data;

    await logActivity(supabase, session, {
      entityId: parsed.data.quoteId,
      entityLabel: quote?.quote_number ?? 'Quote',
      summary: 'Quote converted into an invoice',
      action: 'status_changed',
      metadata: { invoice_id: data },
    });

    invalidate(parsed.data.quoteId);
    revalidatePath('/invoices');
  } catch (error) {
    return toActionError(error, 'We could not generate the invoice.') as ActionState<Data>;
  }

  redirect(`/invoices/${invoiceId}`);
}
