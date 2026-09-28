import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type {
  CustomerAddressRow,
  CustomerRow,
  CustomerStatus,
  CustomerType,
  InvoiceRow,
  InterventionRow,
  QuoteRow,
} from '@/types/database';

/**
 * Server-only read layer for the Customers module.
 *
 * Every query is scoped with `.eq('organization_id', …)` even though RLS already
 * filters: it makes the intent explicit and keeps the queries index-friendly.
 * Related records are loaded with one query per table instead of embedded
 * PostgREST relations, because the hand-written `Database` type does not model
 * relationships.
 */

export const CUSTOMERS_PER_PAGE = 20;
/** Upper bound for the detail page history lists. */
export const CUSTOMER_RELATED_LIMIT = 50;

/** `entity_type` used in `activity_log` for this module. */
export const CUSTOMER_ENTITY_TYPE = 'customer';

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export type CustomerSort = 'name' | 'recent';

export const CUSTOMER_SORTS: { value: CustomerSort; label: string }[] = [
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'recent', label: 'Newest first' },
];

export interface CustomerListFilters {
  organizationId: string;
  q?: string | null;
  type?: CustomerType | null;
  status?: CustomerStatus | null;
  sort?: CustomerSort | null;
  page?: number | null;
  perPage?: number | null;
}

export interface CustomerListResult {
  rows: CustomerRow[];
  total: number;
  page: number;
  perPage: number;
}

export interface CustomerStats {
  interventions: number;
  quotes: number;
  invoices: number;
  addresses: number;
  /** Sum of `invoices.total` excluding cancelled invoices. */
  invoicedTotal: number;
  /** Remaining balance on issued (non-draft, non-cancelled) invoices. */
  outstandingTotal: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * PostgREST splits `or=(…)` filters on commas and parentheses, so those
 * characters can never be forwarded verbatim from a search box.
 */
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

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listCustomers(filters: CustomerListFilters): Promise<CustomerListResult> {
  const supabase = await createSupabaseServerClient();

  const page = Math.max(1, Math.trunc(filters.page ?? 1) || 1);
  const perPage = Math.min(
    100,
    Math.max(1, Math.trunc(filters.perPage ?? CUSTOMERS_PER_PAGE) || CUSTOMERS_PER_PAGE),
  );
  const rangeStart = (page - 1) * perPage;
  const rangeEnd = rangeStart + perPage - 1;

  const term = sanitizeSearchTerm(filters.q?.trim() ?? '');

  let query = supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .eq('organization_id', filters.organizationId);

  if (term.length > 0) {
    const pattern = `%${term}%`;
    query = query.or(
      [
        `name.ilike.${pattern}`,
        `email.ilike.${pattern}`,
        `phone.ilike.${pattern}`,
        `company_name.ilike.${pattern}`,
      ].join(','),
    );
  }

  if (filters.type) query = query.eq('type', filters.type);
  if (filters.status) query = query.eq('status', filters.status);

  if (filters.sort === 'recent') {
    query = query.order('created_at', { ascending: false });
  } else {
    query = query.order('name', { ascending: true });
  }

  // Stable tie-breaker so pagination never repeats or skips a row.
  query = query.order('id', { ascending: true });

  const { data, count, error } = await query.range(rangeStart, rangeEnd);
  if (error) throw error;

  const rows = data ?? [];

  return {
    rows,
    total: count ?? rows.length,
    page,
    perPage,
  };
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export async function getCustomer(organizationId: string, id: string): Promise<CustomerRow | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function getCustomerAddresses(
  organizationId: string,
  customerId: string,
): Promise<CustomerAddressRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('customer_addresses')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('customer_id', customerId)
    .order('is_default', { ascending: false })
    .order('label', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

function relatedLimit(limit: number): number {
  return Math.min(200, Math.max(1, Math.trunc(limit) || CUSTOMER_RELATED_LIMIT));
}

export async function getCustomerInterventions(
  organizationId: string,
  customerId: string,
  limit = CUSTOMER_RELATED_LIMIT,
): Promise<InterventionRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('interventions')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('customer_id', customerId)
    .order('scheduled_start', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(relatedLimit(limit));

  if (error) throw error;
  return data ?? [];
}

export async function getCustomerQuotes(
  organizationId: string,
  customerId: string,
  limit = CUSTOMER_RELATED_LIMIT,
): Promise<QuoteRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('customer_id', customerId)
    .order('issue_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(relatedLimit(limit));

  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Statistics & deletion guard
// ---------------------------------------------------------------------------

export async function getCustomerStats(
  organizationId: string,
  customerId: string,
): Promise<CustomerStats> {
  const supabase = await createSupabaseServerClient();

  const [interventions, quotes, invoices, addresses, invoiceAmounts] = await Promise.all([
    supabase
      .from('interventions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('customer_id', customerId),
    supabase
      .from('quotes')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('customer_id', customerId),
    supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('customer_id', customerId),
    supabase
      .from('customer_addresses')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('customer_id', customerId),
    supabase
      .from('invoices')
      .select('total, amount_paid, status')
      .eq('organization_id', organizationId)
      .eq('customer_id', customerId),
  ]);

  if (interventions.error) throw interventions.error;
  if (quotes.error) throw quotes.error;
  if (invoices.error) throw invoices.error;
  if (addresses.error) throw addresses.error;
  if (invoiceAmounts.error) throw invoiceAmounts.error;

  let invoicedTotal = 0;
  let outstandingTotal = 0;

  for (const row of invoiceAmounts.data ?? []) {
    if (row.status === 'cancelled') continue;

    const total = toNumber(row.total);
    invoicedTotal += total;

    if (row.status !== 'draft') {
      outstandingTotal += Math.max(0, total - toNumber(row.amount_paid));
    }
  }

  return {
    interventions: interventions.count ?? 0,
    quotes: quotes.count ?? 0,
    invoices: invoices.count ?? 0,
    addresses: addresses.count ?? 0,
    invoicedTotal,
    outstandingTotal,
  };
}

export interface CustomerDependencies {
  interventions: number;
  quotes: number;
  invoices: number;
}

/** Counts the documents referencing a customer; used before deleting it. */
export async function getCustomerDependencies(
  organizationId: string,
  customerId: string,
): Promise<CustomerDependencies> {
  const supabase = await createSupabaseServerClient();

  const [interventions, quotes, invoices] = await Promise.all([
    supabase
      .from('interventions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('customer_id', customerId),
    supabase
      .from('quotes')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('customer_id', customerId),
    supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('customer_id', customerId),
  ]);

  if (interventions.error) throw interventions.error;
  if (quotes.error) throw quotes.error;
  if (invoices.error) throw invoices.error;

  return {
    interventions: interventions.count ?? 0,
    quotes: quotes.count ?? 0,
    invoices: invoices.count ?? 0,
  };
}

export async function getCustomerInvoices(
  organizationId: string,
  customerId: string,
  limit = CUSTOMER_RELATED_LIMIT,
): Promise<InvoiceRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('customer_id', customerId)
    .order('issue_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(relatedLimit(limit));

  if (error) throw error;
  return data ?? [];
}

