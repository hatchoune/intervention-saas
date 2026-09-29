import 'server-only';

import { effectiveInvoiceStatus } from '@/lib/domain/status';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type {
  ActivityLogRow,
  CustomerRow,
  InterventionRow,
  InvoiceItemRow,
  InvoiceRow,
  InvoiceStatus,
  QuoteRow,
} from '@/types/database';

/**
 * Server-only read layer for the Invoices module.
 *
 * The stored `status` column is authoritative, but a payment recorded after the
 * due date is only reconciled by the nightly `mark_overdue_invoices()` job, so
 * every list derives the *effective* status at read time with
 * `effectiveInvoiceStatus()` (same rule, shared with the dashboard).
 */

export const INVOICES_PER_PAGE = 20;
/** Upper bound for the line item list of a single invoice. */
export const INVOICE_ITEMS_LIMIT = 200;

export type InvoiceSort = 'recent' | 'oldest' | 'number' | 'amount' | 'due';

export const INVOICE_SORTS: { value: InvoiceSort; label: string }[] = [
  { value: 'recent', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'number', label: 'Number' },
  { value: 'amount', label: 'Highest amount' },
  { value: 'due', label: 'Due date' },
];

export interface InvoiceListFilters {
  q?: string | null;
  status?: InvoiceStatus | null;
  customerId?: string | null;
  /** Keeps only invoices with a remaining balance (hides drafts and cancellations). */
  onlyUnpaid?: boolean | null;
  /** `yyyy-MM-dd` lower bound on `issue_date`. */
  from?: string | null;
  /** `yyyy-MM-dd` upper bound on `issue_date`. */
  to?: string | null;
  sort?: InvoiceSort | null;
  page?: number | null;
  perPage?: number | null;
}

export type InvoiceCustomerSummary = Pick<CustomerRow, 'id' | 'name' | 'city' | 'email'>;

export interface InvoiceListItem extends InvoiceRow {
  customer: InvoiceCustomerSummary | null;
  balance: number;
  /** Status after applying the due-date rule. */
  effectiveStatus: InvoiceStatus;
}

export interface InvoiceListResult {
  rows: InvoiceListItem[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
  summary: InvoiceSummary;
}

export interface InvoiceSummary {
  unpaidCount: number;
  unpaidAmount: number;
  overdueCount: number;
  overdueAmount: number;
  /** Sum paid on invoices issued in the current calendar month. */
  paidThisMonth: number;
}

export interface InvoiceDetail {
  invoice: InvoiceRow;
  customer: InvoiceCustomerSummary | null;
  intervention: InterventionRow | null;
  quote: QuoteRow | null;
  items: InvoiceItemRow[];
  activity: ActivityLogRow[];
  balance: number;
  effectiveStatus: InvoiceStatus;
}

/** A completed intervention that has not been invoiced yet. */
export interface BillableIntervention {
  id: string;
  reference: string;
  title: string;
  customer_id: string;
  customerName: string;
  completed_at: string | null;
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function isDayKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    DAY_KEY.test(value) &&
    !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
  );
}

/** PostgREST splits `or=(…)` on commas and parentheses — never forward them. */
function sanitizeSearchTerm(term: string): string {
  return term
    .replace(/[,()*:;%\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function balanceOf(row: Pick<InvoiceRow, 'total' | 'amount_paid'>): number {
  return Math.max(0, toNumber(row.total) - toNumber(row.amount_paid));
}

async function loadCustomerSummaries(
  ids: string[],
): Promise<Map<string, InvoiceCustomerSummary>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, city, email')
    .in('id', unique);

  if (error) throw error;

  return new Map(
    (data ?? []).map((row) => [
      row.id,
      { id: row.id, name: row.name, city: row.city, email: row.email },
    ]),
  );
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listInvoices(
  organizationId: string,
  filters: InvoiceListFilters = {},
  now = new Date(),
): Promise<InvoiceListResult> {
  const supabase = await createSupabaseServerClient();

  const page = Math.max(1, Math.trunc(filters.page ?? 1) || 1);
  const perPage = Math.min(
    100,
    Math.max(1, Math.trunc(filters.perPage ?? INVOICES_PER_PAGE) || INVOICES_PER_PAGE),
  );
  const rangeStart = (page - 1) * perPage;
  const rangeEnd = rangeStart + perPage - 1;

  const term = sanitizeSearchTerm(filters.q?.trim() ?? '');
  const searchable = term.length >= 2;

  let searchCustomerIds: string[] = [];
  if (searchable) {
    const { data } = await supabase
      .from('customers')
      .select('id')
      .eq('organization_id', organizationId)
      .ilike('name', `%${term}%`)
      .limit(50);

    searchCustomerIds = (data ?? []).map((row) => row.id);
  }

  let query = supabase
    .from('invoices')
    .select('*', { count: 'exact' })
    .eq('organization_id', organizationId);

  if (searchable) {
    const pattern = `%${term}%`;
    const clauses = [`invoice_number.ilike.${pattern}`, `notes.ilike.${pattern}`];
    if (searchCustomerIds.length > 0) {
      clauses.push(`customer_id.in.(${searchCustomerIds.join(',')})`);
    }
    query = query.or(clauses.join(','));
  }

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.customerId) query = query.eq('customer_id', filters.customerId);
  if (isDayKey(filters.from)) query = query.gte('issue_date', filters.from);
  if (isDayKey(filters.to)) query = query.lte('issue_date', filters.to);

  if (filters.onlyUnpaid) {
    // A balance can only exist on an invoice that was actually issued.
    query = query.in('status', ['sent', 'partial', 'overdue'] satisfies InvoiceStatus[]);
    query = query.gt('total', 0);
  }

  switch (filters.sort ?? 'recent') {
    case 'oldest':
      query = query.order('issue_date', { ascending: true });
      break;
    case 'number':
      query = query.order('invoice_number', { ascending: false });
      break;
    case 'amount':
      query = query.order('total', { ascending: false });
      break;
    case 'due':
      query = query.order('due_date', { ascending: true, nullsFirst: false });
      break;
    default:
      query = query.order('issue_date', { ascending: false });
  }

  // Stable tie-breaker so pagination never repeats or skips a row.
  query = query.order('id', { ascending: true });

  const { data, count, error } = await query.range(rangeStart, rangeEnd);
  if (error) throw error;

  let rows = data ?? [];

  // `onlyUnpaid` cannot express "total > amount_paid" in PostgREST, so the
  // remaining balance is filtered in memory — the result set is a single page.
  if (filters.onlyUnpaid) rows = rows.filter((row) => balanceOf(row) > 0);

  const customers = await loadCustomerSummaries(rows.map((row) => row.customer_id));
  const summary = await getInvoiceSummary(organizationId, now);

  return {
    rows: rows.map((row) => ({
      ...row,
      customer: customers.get(row.customer_id) ?? null,
      balance: balanceOf(row),
      effectiveStatus: effectiveInvoiceStatus(row, now),
    })),
    total: count ?? rows.length,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil((count ?? rows.length) / perPage)),
    summary,
  };
}

/**
 * Outstanding money at a glance. Reads a bounded slice of invoices rather than
 * scanning the whole table: a small service business issues at most a few
 * thousand invoices a year, and the header must stay fast.
 */
export async function getInvoiceSummary(
  organizationId: string,
  now = new Date(),
): Promise<InvoiceSummary> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('invoices')
    .select('status, total, amount_paid, issue_date, due_date')
    .eq('organization_id', organizationId)
    .limit(1000);

  if (error) throw error;

  const summary: InvoiceSummary = {
    unpaidCount: 0,
    unpaidAmount: 0,
    overdueCount: 0,
    overdueAmount: 0,
    paidThisMonth: 0,
  };

  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  for (const row of data ?? []) {
    const effective = effectiveInvoiceStatus(row, now);
    const balance = balanceOf(row);

    if ((effective === 'sent' || effective === 'partial' || effective === 'overdue') && balance > 0) {
      summary.unpaidCount += 1;
      summary.unpaidAmount += balance;
    }

    if (effective === 'overdue') {
      summary.overdueCount += 1;
      summary.overdueAmount += balance;
    }

    if (effective === 'paid' && String(row.issue_date).startsWith(monthPrefix)) {
      summary.paidThisMonth += toNumber(row.total);
    }
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export async function getInvoice(
  organizationId: string,
  id: string,
): Promise<InvoiceRow | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function getInvoiceItems(
  organizationId: string,
  invoiceId: string,
): Promise<InvoiceItemRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('invoice_id', invoiceId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(INVOICE_ITEMS_LIMIT);

  if (error) throw error;
  return data ?? [];
}

export async function getInvoiceDetail(
  organizationId: string,
  id: string,
  now = new Date(),
): Promise<InvoiceDetail | null> {
  const invoice = await getInvoice(organizationId, id);
  if (!invoice) return null;

  const supabase = await createSupabaseServerClient();

  const [items, customers, intervention, quote, activity] = await Promise.all([
    getInvoiceItems(organizationId, invoice.id),
    loadCustomerSummaries([invoice.customer_id]),
    invoice.intervention_id
      ? supabase
          .from('interventions')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('id', invoice.intervention_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    invoice.quote_id
      ? supabase
          .from('quotes')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('id', invoice.quote_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('activity_log')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('entity_type', 'invoice')
      .eq('entity_id', invoice.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  if (intervention.error) throw intervention.error;
  if (quote.error) throw quote.error;
  if (activity.error) throw activity.error;

  return {
    invoice,
    customer: customers.get(invoice.customer_id) ?? null,
    intervention: intervention.data ?? null,
    quote: quote.data ?? null,
    items,
    activity: activity.data ?? [],
    balance: balanceOf(invoice),
    effectiveStatus: effectiveInvoiceStatus(invoice, now),
  };
}

// ---------------------------------------------------------------------------
// Form options
// ---------------------------------------------------------------------------

/**
 * Completed interventions without an invoice, ready to be billed. The set of
 * already-invoiced interventions is fetched once (bounded) and subtracted,
 * which avoids one lookup per intervention.
 */
export async function listBillableInterventions(
  organizationId: string,
  options: { customerId?: string | null } = {},
): Promise<BillableIntervention[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from('interventions')
    .select('id, reference, title, customer_id, completed_at')
    .eq('organization_id', organizationId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false, nullsFirst: false })
    .limit(200);

  if (options.customerId) query = query.eq('customer_id', options.customerId);

  const [interventionResult, invoiceResult] = await Promise.all([
    query,
    supabase
      .from('invoices')
      .select('intervention_id')
      .eq('organization_id', organizationId)
      .not('intervention_id', 'is', null)
      .limit(1000),
  ]);

  if (interventionResult.error) throw interventionResult.error;
  if (invoiceResult.error) throw invoiceResult.error;

  const invoiced = new Set(
    (invoiceResult.data ?? [])
      .map((row) => row.intervention_id)
      .filter((id): id is string => Boolean(id)),
  );

  const rows = (interventionResult.data ?? []).filter((row) => !invoiced.has(row.id));
  const customers = await loadCustomerSummaries(rows.map((row) => row.customer_id));

  return rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    title: row.title,
    customer_id: row.customer_id,
    customerName: customers.get(row.customer_id)?.name ?? 'Customer',
    completed_at: row.completed_at,
  }));
}
