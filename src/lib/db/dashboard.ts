import 'server-only';

import { effectiveInvoiceStatus } from '@/lib/domain/status';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type {
  ActivityLogRow,
  DashboardSummary,
  InterventionRow,
  InterventionStatus,
  InvoiceRow,
  InvoiceStatus,
  QuoteRow,
  QuoteStatus,
  RevenueByMonth,
  Uuid,
} from '@/types/database';

/** Row shape used by the dashboard lists (intervention + resolved names). */
export interface DashboardIntervention {
  intervention: InterventionRow;
  customerName: string;
  technicianName: string | null;
  technicianColor: string | null;
}

export interface DashboardQuote {
  quote: QuoteRow;
  customerName: string;
}

export interface DashboardInvoice {
  invoice: InvoiceRow;
  customerName: string;
  /** Status after applying the due-date rule. */
  effectiveStatus: InvoiceStatus;
  balance: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  revenue: RevenueByMonth[];
  today: DashboardIntervention[];
  upcoming: DashboardIntervention[];
  pendingQuotes: DashboardQuote[];
  unpaidInvoices: DashboardInvoice[];
  recentActivity: ActivityLogRow[];
}

export interface GetDashboardOptions {
  organizationId: Uuid;
  /** Set for technicians: restricts the work lists to their own assignments. */
  restrictToTechnicianId?: Uuid | null;
  listLimit?: number;
  now?: Date;
}

const EMPTY_SUMMARY: DashboardSummary = {
  interventions_today: 0,
  interventions_upcoming: 0,
  interventions_in_progress: 0,
  interventions_unassigned: 0,
  interventions_to_invoice: 0,
  pending_quotes: 0,
  pending_quotes_amount: 0,
  unpaid_invoices: 0,
  unpaid_invoices_amount: 0,
  overdue_invoices: 0,
  revenue_this_month: 0,
  revenue_last_month: 0,
  revenue_last_30_days: 0,
  active_customers: 0,
  active_technicians: 0,
};

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

async function customerNamesByIds(ids: Uuid[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('customers').select('id, name').in('id', ids);

  return new Map((data ?? []).map((customer) => [customer.id as string, customer.name as string]));
}

/**
 * Resolves customer and technician display names for a set of interventions
 * with two batched queries (no N+1).
 */
async function decorateInterventions(rows: InterventionRow[]): Promise<DashboardIntervention[]> {
  if (rows.length === 0) return [];

  const supabase = await createSupabaseServerClient();
  const customerIds = [...new Set(rows.map((row) => row.customer_id))];
  const technicianIds = [
    ...new Set(rows.map((row) => row.technician_id).filter((id): id is string => Boolean(id))),
  ];

  const [customersResult, techniciansResult] = await Promise.all([
    supabase.from('customers').select('id, name').in('id', customerIds),
    technicianIds.length > 0
      ? supabase.from('technicians').select('id, full_name, color').in('id', technicianIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string; color: string }[] }),
  ]);

  const customers = new Map(
    (customersResult.data ?? []).map((customer) => [
      customer.id as string,
      customer.name as string,
    ]),
  );
  const technicians = new Map(
    (techniciansResult.data ?? []).map((technician) => [
      technician.id as string,
      { name: technician.full_name as string, color: technician.color as string },
    ]),
  );

  return rows.map((intervention) => {
    const technician = intervention.technician_id
      ? technicians.get(intervention.technician_id)
      : undefined;

    return {
      intervention,
      customerName: customers.get(intervention.customer_id) ?? 'Unknown customer',
      technicianName: technician?.name ?? null,
      technicianColor: technician?.color ?? null,
    };
  });
}

async function hydrateQuoteCustomers(rows: QuoteRow[]): Promise<DashboardQuote[]> {
  const names = await customerNamesByIds([...new Set(rows.map((row) => row.customer_id))]);

  return rows.map((quote) => ({
    quote,
    customerName: names.get(quote.customer_id) ?? 'Unknown customer',
  }));
}

async function hydrateInvoiceCustomers(
  rows: InvoiceRow[],
  now: Date,
): Promise<DashboardInvoice[]> {
  const names = await customerNamesByIds([...new Set(rows.map((row) => row.customer_id))]);

  return rows.map((invoice) => ({
    invoice,
    customerName: names.get(invoice.customer_id) ?? 'Unknown customer',
    effectiveStatus: effectiveInvoiceStatus(invoice, now),
    balance: Math.max(0, Number(invoice.total) - Number(invoice.amount_paid)),
  }));
}

/**
 * Everything the dashboard needs in one call: SQL aggregates, the revenue
 * series, today's and upcoming work, open billing documents and the feed.
 */
export async function getDashboardData({
  organizationId,
  restrictToTechnicianId = null,
  listLimit = 5,
  now = new Date(),
}: GetDashboardOptions): Promise<DashboardData> {
  const supabase = await createSupabaseServerClient();

  const dayStart = startOfDay(now);
  const dayEnd = addDays(dayStart, 1);
  const today = dayStart.toISOString().slice(0, 10);

  const todayQuery = supabase
    .from('interventions')
    .select('*')
    .eq('organization_id', organizationId)
    .neq('status', 'cancelled' satisfies InterventionStatus)
    .gte('scheduled_start', dayStart.toISOString())
    .lt('scheduled_start', dayEnd.toISOString())
    .order('scheduled_start', { ascending: true })
    .limit(20);

  const upcomingQuery = supabase
    .from('interventions')
    .select('*')
    .eq('organization_id', organizationId)
    .in('status', ['draft', 'scheduled', 'in_progress'] satisfies InterventionStatus[])
    .gte('scheduled_start', dayEnd.toISOString())
    .order('scheduled_start', { ascending: true })
    .limit(listLimit);

  const [summaryResult, revenueResult, todayResult, upcomingResult, quotesResult, invoicesResult, activityResult] =
    await Promise.all([
      supabase.rpc('dashboard_summary', { p_organization_id: organizationId, p_today: today }),
      supabase.rpc('revenue_by_month', { p_organization_id: organizationId, p_months: 6 }),
      restrictToTechnicianId ? todayQuery.eq('technician_id', restrictToTechnicianId) : todayQuery,
      restrictToTechnicianId
        ? upcomingQuery.eq('technician_id', restrictToTechnicianId)
        : upcomingQuery,
      supabase
        .from('quotes')
        .select('*')
        .eq('organization_id', organizationId)
        .in('status', ['draft', 'sent'] satisfies QuoteStatus[])
        .order('issue_date', { ascending: false })
        .limit(listLimit),
      supabase
        .from('invoices')
        .select('*')
        .eq('organization_id', organizationId)
        .in('status', ['sent', 'partial', 'overdue'] satisfies InvoiceStatus[])
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(listLimit),
      supabase
        .from('activity_log')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(listLimit + 3),
    ]);

  const [todayRows, upcomingRows, pendingQuotes, unpaidInvoices] = await Promise.all([
    decorateInterventions((todayResult.data ?? []) as InterventionRow[]),
    decorateInterventions((upcomingResult.data ?? []) as InterventionRow[]),
    hydrateQuoteCustomers((quotesResult.data ?? []) as QuoteRow[]),
    hydrateInvoiceCustomers((invoicesResult.data ?? []) as InvoiceRow[], now),
  ]);

  return {
    summary: (summaryResult.data?.[0] as DashboardSummary | undefined) ?? EMPTY_SUMMARY,
    revenue: (revenueResult.data ?? []) as RevenueByMonth[],
    today: todayRows,
    upcoming: upcomingRows,
    pendingQuotes,
    unpaidInvoices,
    recentActivity: (activityResult.data ?? []) as ActivityLogRow[],
  };
}

/** Today's interventions, optionally restricted to a single technician. */
export async function getInterventionsToday(
  organizationId: Uuid,
  technicianId: Uuid | null,
  now = new Date(),
): Promise<DashboardIntervention[]> {
  const supabase = await createSupabaseServerClient();
  const dayStart = startOfDay(now);
  const dayEnd = addDays(dayStart, 1);

  let query = supabase
    .from('interventions')
    .select('*')
    .eq('organization_id', organizationId)
    .neq('status', 'cancelled' satisfies InterventionStatus)
    .gte('scheduled_start', dayStart.toISOString())
    .lt('scheduled_start', dayEnd.toISOString())
    .order('scheduled_start', { ascending: true });

  if (technicianId) query = query.eq('technician_id', technicianId);

  const { data } = await query.limit(50);
  return decorateInterventions((data ?? []) as InterventionRow[]);
}

