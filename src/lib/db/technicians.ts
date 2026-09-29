import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type {
  InterventionRow,
  InterventionStatus,
  TechnicianRow,
  TechnicianStatus,
} from '@/types/database';

/**
 * Server-only read layer for the Technicians module.
 *
 * As everywhere else in `src/lib/db`, every query is scoped with
 * `.eq('organization_id', …)`: RLS already filters, but being explicit keeps the
 * queries index-friendly and makes the tenant boundary visible in review.
 */

export const TECHNICIANS_PER_PAGE = 20;
export const TECHNICIAN_RELATED_LIMIT = 25;

/** `entity_type` used in `activity_log` for this module. */
export const TECHNICIAN_ENTITY_TYPE = 'technician';

/** Statuses that count as "open work" on a technician's desk. */
export const OPEN_INTERVENTION_STATUSES: InterventionStatus[] = [
  'draft',
  'scheduled',
  'in_progress',
];

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export type TechnicianSort = 'name' | 'recent' | 'workload';

export const TECHNICIAN_SORTS: { value: TechnicianSort; label: string }[] = [
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'recent', label: 'Newest first' },
  { value: 'workload', label: 'Most open work' },
];

export interface TechnicianListFilters {
  q?: string | null;
  status?: TechnicianStatus | null;
  /** `false` lists the deactivated team members. Omit for everyone. */
  activeOnly?: boolean | null;
  /** `true` only shows technicians linked to a login, `false` only unlinked. */
  linked?: boolean | null;
  sort?: TechnicianSort | null;
  page?: number | null;
  perPage?: number | null;
}

/** Live workload counters shown in the list and detail views. */
export interface TechnicianLoad {
  /** Draft + scheduled + in progress assignments. */
  open: number;
  inProgress: number;
  /** Assignments scheduled for today. */
  today: number;
  /** Assignments scheduled today or later. */
  upcoming: number;
}

export interface TechnicianListItem extends TechnicianRow {
  load: TechnicianLoad;
}

export interface TechnicianListResult {
  rows: TechnicianListItem[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
}

export interface TechnicianDetailLoad extends TechnicianLoad {
  /** Exact count of completed interventions. */
  completed: number;
}

export interface TechnicianDetail {
  technician: TechnicianRow;
  load: TechnicianDetailLoad;
  upcoming: InterventionRow[];
  recent: InterventionRow[];
}

/** A member of the organisation that can be linked to a technician profile. */
export interface MemberOption {
  userId: string;
  label: string;
  /** Technician row already linked to this login (and not the edited one). */
  linkedTechnicianId: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_LOAD: TechnicianLoad = { open: 0, inProgress: 0, today: 0, upcoming: 0 };

/** PostgREST splits `or=(…)` on commas and parentheses — never forward them. */
function sanitizeSearchTerm(term: string): string {
  return term
    .replace(/[,()*:;%\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dayBounds(now: Date): { start: Date; end: Date } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

/**
 * Aggregates the open workload of every technician with a single query and
 * buckets it in memory. Open work is naturally bounded (what a small team has on
 * its plate at one point in time), so this stays cheap and avoids one count
 * query per technician.
 */
async function loadWorkloads(
  organizationId: string,
  now = new Date(),
): Promise<Map<string, TechnicianLoad>> {
  const supabase = await createSupabaseServerClient();
  const { start, end } = dayBounds(now);

  const { data, error } = await supabase
    .from('interventions')
    .select('technician_id, status, scheduled_start')
    .eq('organization_id', organizationId)
    .in('status', OPEN_INTERVENTION_STATUSES)
    .limit(1000);

  if (error) throw error;

  const loads = new Map<string, TechnicianLoad>();

  for (const row of data ?? []) {
    if (!row.technician_id) continue;

    const current = loads.get(row.technician_id) ?? { ...EMPTY_LOAD };
    current.open += 1;
    if (row.status === 'in_progress') current.inProgress += 1;

    if (row.scheduled_start) {
      const scheduled = new Date(row.scheduled_start);
      if (!Number.isNaN(scheduled.getTime())) {
        if (scheduled >= start && scheduled < end) current.today += 1;
        if (scheduled >= start) current.upcoming += 1;
      }
    }

    loads.set(row.technician_id, current);
  }

  return loads;
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listTechnicians(
  organizationId: string,
  filters: TechnicianListFilters = {},
): Promise<TechnicianListResult> {
  const supabase = await createSupabaseServerClient();

  const page = Math.max(1, Math.trunc(filters.page ?? 1) || 1);
  const perPage = Math.min(
    100,
    Math.max(1, Math.trunc(filters.perPage ?? TECHNICIANS_PER_PAGE) || TECHNICIANS_PER_PAGE),
  );
  const rangeStart = (page - 1) * perPage;
  const rangeEnd = rangeStart + perPage - 1;

  const term = sanitizeSearchTerm(filters.q?.trim() ?? '');

  let query = supabase
    .from('technicians')
    .select('*', { count: 'exact' })
    .eq('organization_id', organizationId);

  if (term.length >= 2) {
    const pattern = `%${term}%`;
    query = query.or(
      [`full_name.ilike.${pattern}`, `email.ilike.${pattern}`, `job_title.ilike.${pattern}`].join(
        ',',
      ),
    );
  }

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.activeOnly === true || filters.activeOnly === false) {
    query = query.eq('is_active', filters.activeOnly);
  }
  if (filters.linked === true) query = query.not('user_id', 'is', null);
  if (filters.linked === false) query = query.is('user_id', null);

  const sort = filters.sort ?? 'name';
  // `workload` is ordered in memory: PostgREST cannot sort on a computed count.
  query =
    sort === 'recent'
      ? query.order('created_at', { ascending: false })
      : query.order('full_name', { ascending: true });

  // Stable tie-breaker so pagination never repeats or skips a row.
  query = query.order('id', { ascending: true });

  const { data, count, error } = await query.range(rangeStart, rangeEnd);
  if (error) throw error;

  const rows = data ?? [];
  const loads = await loadWorkloads(organizationId);

  let decorated: TechnicianListItem[] = rows.map((row) => ({
    ...row,
    load: loads.get(row.id) ?? { ...EMPTY_LOAD },
  }));

  if (sort === 'workload') {
    decorated = decorated.sort(
      (left, right) =>
        right.load.open - left.load.open || left.full_name.localeCompare(right.full_name),
    );
  }

  const total = count ?? decorated.length;

  return {
    rows: decorated,
    total,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
  };
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export async function getTechnician(
  organizationId: string,
  id: string,
): Promise<TechnicianRow | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('technicians')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

/** Technician profile attached to a login (used by the technician-facing views). */
export async function getTechnicianForUser(
  organizationId: string,
  userId: string,
): Promise<TechnicianRow | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('technicians')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function getTechnicianInterventions(
  organizationId: string,
  technicianId: string,
  options: { direction?: 'upcoming' | 'recent'; limit?: number } = {},
): Promise<InterventionRow[]> {
  const supabase = await createSupabaseServerClient();
  const limit = Math.min(100, Math.max(1, options.limit ?? TECHNICIAN_RELATED_LIMIT));

  const base = supabase
    .from('interventions')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('technician_id', technicianId);

  const ordered =
    options.direction === 'recent'
      ? base.order('created_at', { ascending: false })
      : base
          .order('scheduled_start', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: false });

  const { data, error } = await ordered.limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getTechnicianDetail(
  organizationId: string,
  id: string,
  now = new Date(),
): Promise<TechnicianDetail | null> {
  const technician = await getTechnician(organizationId, id);
  if (!technician) return null;

  const supabase = await createSupabaseServerClient();

  const [loads, completed, upcoming, recent] = await Promise.all([
    loadWorkloads(organizationId, now),
    supabase
      .from('interventions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('technician_id', id)
      .eq('status', 'completed' satisfies InterventionStatus),
    getTechnicianInterventions(organizationId, id, { direction: 'upcoming' }),
    getTechnicianInterventions(organizationId, id, { direction: 'recent', limit: 10 }),
  ]);

  if (completed.error) throw completed.error;

  return {
    technician,
    load: {
      ...(loads.get(id) ?? { ...EMPTY_LOAD }),
      completed: completed.count ?? 0,
    },
    upcoming,
    recent,
  };
}

/** Number of interventions that would block deleting this technician. */
export async function countTechnicianDependencies(
  organizationId: string,
  technicianId: string,
): Promise<number> {
  const supabase = await createSupabaseServerClient();

  const { count, error } = await supabase
    .from('interventions')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('technician_id', technicianId);

  if (error) throw error;
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Form options
// ---------------------------------------------------------------------------

/**
 * Members of the organisation that can be linked to a technician profile. When a
 * member is already linked to another technician, `linkedTechnicianId` is set so
 * the form can disable that option instead of failing on the unique constraint.
 */
export async function listMemberOptions(
  organizationId: string,
  options: { excludeTechnicianId?: string } = {},
): Promise<MemberOption[]> {
  const supabase = await createSupabaseServerClient();

  const [membershipResult, technicianResult] = await Promise.all([
    supabase.from('memberships').select('*').eq('organization_id', organizationId),
    supabase.from('technicians').select('id, user_id').eq('organization_id', organizationId),
  ]);

  if (membershipResult.error) throw membershipResult.error;
  if (technicianResult.error) throw technicianResult.error;

  const memberships = membershipResult.data ?? [];
  const userIds = memberships.map((membership) => membership.user_id);

  const profilesResult =
    userIds.length > 0
      ? await supabase.from('profiles').select('*').in('id', userIds)
      : { data: [] };

  const profilesById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
  const linkedByUser = new Map(
    (technicianResult.data ?? [])
      .filter((technician) => Boolean(technician.user_id))
      .map((technician) => [technician.user_id as string, technician.id]),
  );

  return memberships
    .map((membership) => {
      const linkedId = linkedByUser.get(membership.user_id) ?? null;

      return {
        userId: membership.user_id,
        label: profilesById.get(membership.user_id)?.full_name ?? 'Member',
        linkedTechnicianId:
          linkedId && linkedId !== options.excludeTechnicianId ? linkedId : null,
      } satisfies MemberOption;
    })
    .sort((left, right) => left.label.localeCompare(right.label));
}
