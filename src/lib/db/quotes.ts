import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type {
  ActivityLogRow,
  CustomerRow,
  InterventionRow,
  QuoteItemRow,
  QuoteRow,
  QuoteStatus,
} from '@/types/database';

/**
 * Server-only read layer for the Quotes module.
 *
 * Money columns (`subtotal`, `vat_total`, `total`, …) are always read from the
 * database: they are maintained by the triggers in
 * `supabase/migrations/20250101000007_quotes.sql`, never by the application.
 */

export const QUOTES_PER_PAGE = 20;
/** Upper bound for the line item list of a single quote. */
export const QUOTE_ITEMS_LIMIT = 200;

export type QuoteSort = 'recent' | 'oldest' | 'number' | 'amount' | 'validity';

export const QUOTE_SORTS: { value: QuoteSort; label: string }[] = [
  { value: 'recent', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'number', label: 'Number' },
  { value: 'amount', label: 'Highest amount' },
  { value: 'validity', label: 'Validity date' },
];

export interface QuoteListFilters {
  q?: string | null;
  status?: QuoteStatus | null;
  customerId?: string | null;
  /** `yyyy-MM-dd` lower bound on `issue_date`. */
  from?: string | null;
  /** `yyyy-MM-dd` upper bound on `issue_date`. */
  to?: string | null;
  sort?: QuoteSort | null;
  page?: number | null;
  perPage?: number | null;
}

export type QuoteCustomerSummary = Pick<CustomerRow, 'id' | 'name' | 'city' | 'email'>;

export interface QuoteListItem extends QuoteRow {
  customer: QuoteCustomerSummary | null;
}

export interface QuoteListResult {
  rows: QuoteListItem[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
  /** Aggregate of the current filter, for the page summary cards. */
  totals: QuoteListTotals;
}

export interface QuoteListTotals {
  openCount: number;
  openAmount: number;
  acceptedCount: number;
  acceptedAmount: number;
}

export interface QuoteDetail {
  quote: QuoteRow;
  customer: QuoteCustomerSummary | null;
  intervention: InterventionRow | null;
  items: QuoteItemRow[];
  activity: ActivityLogRow[];
}

/** Option used by the "create an invoice from a quote" flow. */
export interface QuoteOption {
  id: string;
  quote_number: string;
  customer_id: string;
  customerName: string;
  total: number;
  currency: string;
  issue_date: string;
  status: QuoteStatus;
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

async function loadCustomerSummaries(
  ids: string[],
): Promise<Map<string, QuoteCustomerSummary>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, city, email')
    .in('id', unique);

  if (error) throw error;
  return new Map(
    (data ?? []).map((row) => [row.id, { id: row.id, name: row.name, city: row.city, email: row.email }]),
  );
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listQuotes(
  organizationId: string,
  filters: QuoteListFilters = {},
): Promise<QuoteListResult> {
  const supabase = await createSupabaseServerClient();

  const page = Math.max(1, Math.trunc(filters.page ?? 1) || 1);
  const perPage = Math.min(
    100,
    Math.max(1, Math.trunc(filters.perPage ?? QUOTES_PER_PAGE) || QUOTES_PER_PAGE),
  );
  const rangeStart = (page - 1) * perPage;
  const rangeEnd = rangeStart + perPage - 1;

  const term = sanitizeSearchTerm(filters.q?.trim() ?? '');
  const searchable = term.length >= 2;

  // The search also covers the customer name: resolve the matching customers
  // first (one extra query at most) and fold their ids into the filter.
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
    .from('quotes')
    .select('*', { count: 'exact' })
    .eq('organization_id', organizationId);

  if (searchable) {
    const pattern = `%${term}%`;
    const clauses = [`quote_number.ilike.${pattern}`, `notes.ilike.${pattern}`];
    if (searchCustomerIds.length > 0) {
      clauses.push(`customer_id.in.(${searchCustomerIds.join(',')})`);
    }
    query = query.or(clauses.join(','));
  }

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.customerId) query = query.eq('customer_id', filters.customerId);
  if (isDayKey(filters.from)) query = query.gte('issue_date', filters.from);
  if (isDayKey(filters.to)) query = query.lte('issue_date', filters.to);

  switch (filters.sort ?? 'recent') {
    case 'oldest':
      query = query.order('issue_date', { ascending: true });
      break;
    case 'number':
      query = query.order('quote_number', { ascending: false });
      break;
    case 'amount':
      query = query.order('total', { ascending: false });
      break;
    case 'validity':
      query = query.order('valid_until', { ascending: true, nullsFirst: false });
      break;
    default:
      query = query.order('issue_date', { ascending: false });
  }

  // Stable tie-breaker so pagination never repeats or skips a row.
  query = query.order('id', { ascending: true });

  const { data, count, error } = await query.range(rangeStart, rangeEnd);
  if (error) throw error;

  const rows = data ?? [];
  const customers = await loadCustomerSummaries(rows.map((row) => row.customer_id));

  const totals = await getQuoteTotals(organizationId, filters);

  return {
    rows: rows.map((row) => ({ ...row, customer: customers.get(row.customer_id) ?? null })),
    total: count ?? rows.length,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil((count ?? rows.length) / perPage)),
    totals,
  };
}

/**
 * Aggregates the filtered quotes for the summary cards. Bounded by an explicit
 * limit because a page header is not worth an unbounded scan.
 */
export async function getQuoteTotals(
  organizationId: string,
  filters: QuoteListFilters = {},
): Promise<QuoteListTotals> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from('quotes')
    .select('status, total')
    .eq('organization_id', organizationId)
    .limit(1000);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.customerId) query = query.eq('customer_id', filters.customerId);
  if (isDayKey(filters.from)) query = query.gte('issue_date', filters.from);
  if (isDayKey(filters.to)) query = query.lte('issue_date', filters.to);

  const { data, error } = await query;
  if (error) throw error;

  const totals: QuoteListTotals = {
    openCount: 0,
    openAmount: 0,
    acceptedCount: 0,
    acceptedAmount: 0,
  };

  for (const row of data ?? []) {
    const amount = toNumber(row.total);

    if (row.status === 'draft' || row.status === 'sent') {
      totals.openCount += 1;
      totals.openAmount += amount;
    }

    if (row.status === 'accepted') {
      totals.acceptedCount += 1;
      totals.acceptedAmount += amount;
    }
  }

  return totals;
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export async function getQuote(organizationId: string, id: string): Promise<QuoteRow | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function getQuoteItems(
  organizationId: string,
  quoteId: string,
): Promise<QuoteItemRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('quote_items')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('quote_id', quoteId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(QUOTE_ITEMS_LIMIT);

  if (error) throw error;
  return data ?? [];
}

export async function getQuoteDetail(
  organizationId: string,
  id: string,
): Promise<QuoteDetail | null> {
  const quote = await getQuote(organizationId, id);
  if (!quote) return null;

  const supabase = await createSupabaseServerClient();

  const [items, customers, intervention, activity] = await Promise.all([
    getQuoteItems(organizationId, quote.id),
    loadCustomerSummaries([quote.customer_id]),
    quote.intervention_id
      ? supabase
          .from('interventions')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('id', quote.intervention_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('activity_log')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('entity_type', 'quote')
      .eq('entity_id', quote.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  if (intervention.error) throw intervention.error;
  if (activity.error) throw activity.error;

  return {
    quote,
    customer: customers.get(quote.customer_id) ?? null,
    intervention: intervention.data ?? null,
    items,
    activity: activity.data ?? [],
  };
}

// ---------------------------------------------------------------------------
// Form options
// ---------------------------------------------------------------------------

/** Quotes that can still be invoiced (accepted and not yet converted). */
export async function listQuotableQuotes(
  organizationId: string,
  options: { customerId?: string | null } = {},
): Promise<QuoteOption[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from('quotes')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'accepted')
    .is('converted_invoice_id', null);

  if (options.customerId) query = query.eq('customer_id', options.customerId);

  const { data, error } = await query.order('issue_date', { ascending: false }).limit(200);
  if (error) throw error;

  const rows = data ?? [];
  const customers = await loadCustomerSummaries(rows.map((row) => row.customer_id));

  return rows.map((row) => ({
    id: row.id,
    quote_number: row.quote_number,
    customer_id: row.customer_id,
    customerName: customers.get(row.customer_id)?.name ?? 'Customer',
    total: toNumber(row.total),
    currency: row.currency,
    issue_date: row.issue_date,
    status: row.status,
  }));
}
