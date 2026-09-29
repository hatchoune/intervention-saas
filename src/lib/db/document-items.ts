import 'server-only';

import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { EditableLine } from '@/lib/validation/document';

/**
 * Line item synchronisation shared by quotes and invoices.
 *
 * Updating a document replaces its lines: existing rows are updated in place
 * (their ids are stable, which keeps the derived `line_total` history readable),
 * brand new lines are inserted, and lines the user removed are deleted. Every
 * write goes through `.eq('organization_id', …)`, and RLS stays the final gate.
 *
 * Money columns are never written here — PostgreSQL triggers own them
 * (`supabase/migrations/20250101000007_quotes.sql`).
 */

function payloadOf(line: EditableLine, position: number) {
  return {
    position,
    description: line.description,
    unit: line.unit,
    quantity: line.quantity,
    unit_price: line.unitPrice,
    vat_rate: line.vatRate,
    discount_percent: line.discountPercent,
  };
}

export interface SyncResult {
  /** First database error encountered, or null when everything was applied. */
  error: unknown;
}

export async function syncQuoteItems(
  supabase: SupabaseServerClient,
  organizationId: string,
  quoteId: string,
  lines: EditableLine[],
): Promise<SyncResult> {
  const { data: existing, error: loadError } = await supabase
    .from('quote_items')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('quote_id', quoteId);

  if (loadError) return { error: loadError };

  const existingIds = new Set((existing ?? []).map((row) => row.id));
  const keptIds = new Set<string>();

  for (const [index, line] of lines.entries()) {
    const payload = payloadOf(line, index);

    if (line.id && existingIds.has(line.id)) {
      keptIds.add(line.id);
      const { error } = await supabase
        .from('quote_items')
        .update(payload)
        .eq('id', line.id)
        .eq('organization_id', organizationId)
        .eq('quote_id', quoteId);

      if (error) return { error };
    } else {
      const { error } = await supabase.from('quote_items').insert({
        organization_id: organizationId,
        quote_id: quoteId,
        ...payload,
      });

      if (error) return { error };
    }
  }

  const removedIds = [...existingIds].filter((id) => !keptIds.has(id));

  if (removedIds.length > 0) {
    const { error } = await supabase
      .from('quote_items')
      .delete()
      .eq('organization_id', organizationId)
      .eq('quote_id', quoteId)
      .in('id', removedIds);

    if (error) return { error };
  }

  return { error: null };
}

export async function syncInvoiceItems(
  supabase: SupabaseServerClient,
  organizationId: string,
  invoiceId: string,
  lines: EditableLine[],
): Promise<SyncResult> {
  const { data: existing, error: loadError } = await supabase
    .from('invoice_items')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('invoice_id', invoiceId);

  if (loadError) return { error: loadError };

  const existingIds = new Set((existing ?? []).map((row) => row.id));
  const keptIds = new Set<string>();

  for (const [index, line] of lines.entries()) {
    const payload = payloadOf(line, index);

    if (line.id && existingIds.has(line.id)) {
      keptIds.add(line.id);
      const { error } = await supabase
        .from('invoice_items')
        .update(payload)
        .eq('id', line.id)
        .eq('organization_id', organizationId)
        .eq('invoice_id', invoiceId);

      if (error) return { error };
    } else {
      const { error } = await supabase.from('invoice_items').insert({
        organization_id: organizationId,
        invoice_id: invoiceId,
        ...payload,
      });

      if (error) return { error };
    }
  }

  const removedIds = [...existingIds].filter((id) => !keptIds.has(id));

  if (removedIds.length > 0) {
    const { error } = await supabase
      .from('invoice_items')
      .delete()
      .eq('organization_id', organizationId)
      .eq('invoice_id', invoiceId)
      .in('id', removedIds);

    if (error) return { error };
  }

  return { error: null };
}
