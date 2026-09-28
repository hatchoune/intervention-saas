import 'server-only';

import { addDays, endOfDay, format, startOfDay, startOfWeek } from 'date-fns';

import { createSupabaseServerClient, type SupabaseServerClient } from '@/lib/supabase/server';
import type { InterventionRow, InterventionStatus, TechnicianRow } from '@/types/database';
import type { CustomerSummary, TechnicianSummary } from '@/lib/db/interventions';
import { isDayKey } from '@/lib/db/interventions';

/**
 * Server-only read layer for the Planning module.
 *
 * Every view (day / week / upcoming) returns *grouped* data so the pages stay
 * presentational, and every query resolves its joins with one batched query per
 * related table instead of embedded relations.
 */

const CANCELLED: InterventionStatus = 'cancelled';

export interface PlanningEntry {
  intervention: InterventionRow;
  customer: CustomerSummary | null;
  technician: TechnicianSummary | null;
}

export interface TechnicianLane {
  technician: TechnicianRow;
  entries: PlanningEntry[];
}

export interface DaySchedule {
  /** `yyyy-MM-dd` of the rendered day. */
  date: string;
  /** Interventions nobody is assigned to yet — rendered first. */
  unassigned: PlanningEntry[];
  lanes: TechnicianLane[];
  total: number;
}

export interface WeekDayPlan {
  /** `yyyy-MM-dd`. */
  date: string;
  entries: PlanningEntry[];
}

export interface WeekSchedule {
  /** Monday of the rendered week, `yyyy-MM-dd`. */
  start: string;
  days: WeekDayPlan[];
  /** Draft/scheduled work with no date and no technician. */
  unassigned: PlanningEntry[];
  total: number;
}

export interface UpcomingGroup {
  /** `yyyy-MM-dd`. */
  date: string;
  entries: PlanningEntry[];
}

export interface UpcomingSchedule {
  from: string;
  to: string;
  days: number;
  total: number;
  groups: UpcomingGroup[];
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

export function toDayKey(value: Date): string {
  return format(value, 'yyyy-MM-dd');
}

/** Parses a `yyyy-MM-dd` query param, falling back to today. */
export function resolveDay(value: string | null | undefined): Date {
  if (isDayKey(value)) return startOfDay(new Date(`${value}T00:00:00`));
  return startOfDay(new Date());
}

/** Parses a date param and snaps it to the Monday of its week. */
export function resolveWeekStart(value: string | null | undefined): Date {
  const day = resolveDay(value);
  return startOfWeek(day, { weekStartsOn: 1 });
}

export function resolveWindowDays(value: string | null | undefined, fallback = 30): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(120, Math.max(1, parsed));
}

function localDayKey(iso: string): string {
  return toDayKey(new Date(iso));
}

// ---------------------------------------------------------------------------
// Shared loading / grouping
// ---------------------------------------------------------------------------

async function collectEntries(
  supabase: SupabaseServerClient,
  organizationId: string,
  rows: InterventionRow[],
): Promise<PlanningEntry[]> {
  if (rows.length === 0) return [];

  const customerIds = [...new Set(rows.map((row) => row.customer_id))];
  const technicianIds = [...new Set(rows.flatMap((row) => (row.technician_id ? [row.technician_id] : [])))];

  const [customerResult, technicianResult] = await Promise.all([
    supabase.from('customers').select('*').eq('organization_id', organizationId).in('id', customerIds),
    technicianIds.length > 0
      ? supabase.from('technicians').select('*').eq('organization_id', organizationId).in('id', technicianIds)
      : Promise.resolve({ data: [] as TechnicianRow[], error: null }),
  ]);

  const customers = new Map<string, CustomerSummary>(
    (customerResult.data ?? []).map((row) => [row.id, { id: row.id, name: row.name, city: row.city }]),
  );
  const technicians = new Map<string, TechnicianSummary>(
    (technicianResult.data ?? []).map((row) => [
      row.id,
      { id: row.id, full_name: row.full_name, color: row.color },
    ]),
  );

  return rows.map((intervention) => ({
    intervention,
    customer: customers.get(intervention.customer_id) ?? null,
    technician: intervention.technician_id
      ? (technicians.get(intervention.technician_id) ?? null)
      : null,
  }));
}

/** Scheduled interventions in `[start, end]`, cancelled ones excluded. */
async function loadScheduled(
  supabase: SupabaseServerClient,
  organizationId: string,
  start: Date,
  end: Date,
): Promise<InterventionRow[]> {
  const { data, error } = await supabase
    .from('interventions')
    .select('*')
    .eq('organization_id', organizationId)
    .neq('status', CANCELLED)
    .gte('scheduled_start', start.toISOString())
    .lte('scheduled_start', end.toISOString())
    .order('scheduled_start', { ascending: true })
    .order('id', { ascending: true });

  if (error) throw error;
  return data ?? [];
}
// ---------------------------------------------------------------------------
// Day view
// ---------------------------------------------------------------------------

/**
 * Schedule for one day, grouped by technician. The unassigned bucket is
 * returned separately so the page can pin it as the first column, and every
 * active technician gets a lane even when they have no work.
 */
export async function getDaySchedule(
  organizationId: string,
  date: string | null | undefined,
): Promise<DaySchedule> {
  const supabase = await createSupabaseServerClient();
  const day = resolveDay(date);

  const [rows, technicianResult] = await Promise.all([
    loadScheduled(supabase, organizationId, startOfDay(day), endOfDay(day)),
    supabase
      .from('technicians')
      .select('*')
      .eq('organization_id', organizationId)
      .order('full_name', { ascending: true }),
  ]);

  const entries = await collectEntries(supabase, organizationId, rows);

  const byTechnician = new Map<string, PlanningEntry[]>();
  const unassigned: PlanningEntry[] = [];

  for (const entry of entries) {
    const technicianId = entry.intervention.technician_id;
    if (!technicianId) {
      unassigned.push(entry);
      continue;
    }
    const bucket = byTechnician.get(technicianId);
    if (bucket) bucket.push(entry);
    else byTechnician.set(technicianId, [entry]);
  }

  const lanes: TechnicianLane[] = (technicianResult.data ?? [])
    .map((technician) => ({
      technician,
      entries: byTechnician.get(technician.id) ?? [],
    }))
    // Inactive technicians stay visible only when they still have work that day.
    .filter((lane) => lane.technician.is_active || lane.entries.length > 0);

  return { date: toDayKey(day), unassigned, lanes, total: entries.length };
}

// ---------------------------------------------------------------------------
// Week view
// ---------------------------------------------------------------------------

/** Seven day columns (Monday → Sunday) plus the "to plan" bucket. */
export async function getWeekSchedule(
  organizationId: string,
  startDate: string | null | undefined,
): Promise<WeekSchedule> {
  const supabase = await createSupabaseServerClient();
  const weekStart = resolveWeekStart(startDate);
  const weekEnd = addDays(weekStart, 6);

  const [rows, unassignedResult] = await Promise.all([
    loadScheduled(supabase, organizationId, startOfDay(weekStart), endOfDay(weekEnd)),
    supabase
      .from('interventions')
      .select('*')
      .eq('organization_id', organizationId)
      .in('status', ['draft', 'scheduled'])
      .is('scheduled_start', null)
      .is('technician_id', null)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(50),
  ]);

  const [entries, unassigned] = await Promise.all([
    collectEntries(supabase, organizationId, rows),
    collectEntries(supabase, organizationId, unassignedResult.data ?? []),
  ]);

  const buckets = new Map<string, PlanningEntry[]>();
  for (const entry of entries) {
    const scheduledStart = entry.intervention.scheduled_start;
    if (!scheduledStart) continue;
    const key = localDayKey(scheduledStart);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(entry);
    else buckets.set(key, [entry]);
  }

  const days: WeekDayPlan[] = Array.from({ length: 7 }, (_, index) => {
    const dayKey = toDayKey(addDays(weekStart, index));
    return { date: dayKey, entries: buckets.get(dayKey) ?? [] };
  });

  return { start: toDayKey(weekStart), days, unassigned, total: entries.length };
}

// ---------------------------------------------------------------------------
// Upcoming view
// ---------------------------------------------------------------------------

export interface UpcomingFilters {
  days?: number;
  technicianId?: string | null;
  status?: InterventionStatus | null;
}

/** Scheduled interventions over the next `days` days, grouped by day. */
export async function getUpcoming(
  organizationId: string,
  filters: UpcomingFilters = {},
): Promise<UpcomingSchedule> {
  const supabase = await createSupabaseServerClient();
  const days = Math.min(120, Math.max(1, filters.days ?? 30));
  const from = startOfDay(new Date());
  const to = endOfDay(addDays(from, days));

  let query = supabase
    .from('interventions')
    .select('*')
    .eq('organization_id', organizationId)
    .neq('status', CANCELLED)
    .gte('scheduled_start', from.toISOString())
    .lte('scheduled_start', to.toISOString());

  if (filters.technicianId) query = query.eq('technician_id', filters.technicianId);
  if (filters.status) query = query.eq('status', filters.status);

  const { data, error } = await query
    .order('scheduled_start', { ascending: true })
    .order('id', { ascending: true });

  if (error) throw error;

  const entries = await collectEntries(supabase, organizationId, data ?? []);

  const buckets = new Map<string, PlanningEntry[]>();
  for (const entry of entries) {
    const scheduledStart = entry.intervention.scheduled_start;
    if (!scheduledStart) continue;
    const key = localDayKey(scheduledStart);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(entry);
    else buckets.set(key, [entry]);
  }

  const groups: UpcomingGroup[] = [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, groupEntries]) => ({ date, entries: groupEntries }));

  return {
    from: toDayKey(from),
    to: toDayKey(to),
    days,
    total: entries.length,
    groups,
  };
}

