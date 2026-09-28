import 'server-only';

import { createSupabaseServerClient, type SupabaseServerClient } from '@/lib/supabase/server';
import type {
  ActivityLogRow,
  CustomerAddressRow,
  CustomerRow,
  InterventionPhotoRow,
  InterventionPriority,
  InterventionRow,
  InterventionStatus,
  TechnicianRow,
} from '@/types/database';

/**
 * Server-only read layer for the Interventions module.
 *
 * Joins are resolved with one batched query per related table instead of
 * embedded PostgREST relations: the hand-written `Database` type does not model
 * relationships, so this keeps every query fully typed and avoids N+1.
 */

export const INTERVENTIONS_PER_PAGE = 20;
export const INTERVENTION_PHOTO_BUCKET = 'intervention-photos';
/** Signed URLs are short lived: the bucket stays private. */
export const PHOTO_SIGNED_URL_TTL_SECONDS = 60 * 10;

/** `entity_type` used in `activity_log` for this module. */
export const INTERVENTION_ENTITY_TYPE = 'intervention';

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export type InterventionSort = 'recent' | 'oldest' | 'scheduled' | 'priority' | 'reference';

export const INTERVENTION_SORTS: { value: InterventionSort; label: string }[] = [
  { value: 'recent', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'scheduled', label: 'Soonest scheduled' },
  { value: 'priority', label: 'Highest priority' },
  { value: 'reference', label: 'Reference' },
];

export interface InterventionFilters {
  q?: string | null;
  status?: InterventionStatus | null;
  priority?: InterventionPriority | null;
  technicianId?: string | null;
  customerId?: string | null;
  /** `yyyy-MM-dd` lower bound on `scheduled_start`. */
  from?: string | null;
  /** `yyyy-MM-dd` upper bound on `scheduled_start`. */
  to?: string | null;
  sort?: InterventionSort | null;
  page?: number | null;
  perPage?: number | null;
}

export type CustomerSummary = Pick<CustomerRow, 'id' | 'name' | 'city'>;
export type TechnicianSummary = Pick<TechnicianRow, 'id' | 'full_name' | 'color'>;

export interface InterventionListItem extends InterventionRow {
  customer: CustomerSummary | null;
  technician: TechnicianSummary | null;
}

export interface InterventionListResult {
  rows: InterventionListItem[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
}

export type CustomerOption = Pick<
  CustomerRow,
  | 'id'
  | 'name'
  | 'type'
  | 'status'
  | 'email'
  | 'phone'
  | 'address_line1'
  | 'address_line2'
  | 'postal_code'
  | 'city'
  | 'country'
>;

export type TechnicianOption = Pick<TechnicianRow, 'id' | 'full_name' | 'color' | 'status'>;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function isDayKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    DAY_KEY.test(value) &&
    !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
  );
}

/** Local midnight of a `yyyy-MM-dd` key, as an ISO string for `timestamptz`. */
export function dayStartIso(date: string): string {
  return new Date(`${date}T00:00:00`).toISOString();
}

/** Last millisecond of a `yyyy-MM-dd` day, as an ISO string. */
export function dayEndIso(date: string): string {
  return new Date(`${date}T23:59:59.999`).toISOString();
}

/**
 * PostgREST splits `or=(…)` filters on commas and parentheses, so those
 * characters can never be forwarded verbatim from a search box.
 */
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()*:;%\\]/g, ' ').replace(/\s+/g, ' ').trim();
}

function toSummary(row: CustomerRow): CustomerSummary {
  return { id: row.id, name: row.name, city: row.city };
}

function toTechnicianSummary(row: TechnicianRow): TechnicianSummary {
  return { id: row.id, full_name: row.full_name, color: row.color };
}

/** One query for every customer referenced by a result set. */
async function loadCustomerSummaries(
  supabase: SupabaseServerClient,
  organizationId: string,
  ids: string[],
): Promise<Map<string, CustomerSummary>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const { data } = await supabase
    .from('customers')
    .select('*')
    .eq('organization_id', organizationId)
    .in('id', unique);

  return new Map((data ?? []).map((row) => [row.id, toSummary(row)]));
}

/** One query for every technician referenced by a result set. */
async function loadTechnicianSummaries(
  supabase: SupabaseServerClient,
  organizationId: string,
  ids: string[],
): Promise<Map<string, TechnicianSummary>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const { data } = await supabase
    .from('technicians')
    .select('*')
    .eq('organization_id', organizationId)
    .in('id', unique);

  return new Map((data ?? []).map((row) => [row.id, toTechnicianSummary(row)]));
}

function decorate(
  rows: InterventionRow[],
  customers: Map<string, CustomerSummary>,
  technicians: Map<string, TechnicianSummary>,
): InterventionListItem[] {
  return rows.map((row) => ({
    ...row,
    customer: customers.get(row.customer_id) ?? null,
    technician: row.technician_id ? (technicians.get(row.technician_id) ?? null) : null,
  }));
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listInterventions(
  organizationId: string,
  filters: InterventionFilters = {},
): Promise<InterventionListResult> {
  const supabase = await createSupabaseServerClient();

  const page = Math.max(1, Math.trunc(filters.page ?? 1) || 1);
  const perPage = Math.min(
    100,
    Math.max(1, Math.trunc(filters.perPage ?? INTERVENTIONS_PER_PAGE) || INTERVENTIONS_PER_PAGE),
  );
  const rangeStart = (page - 1) * perPage;
  const rangeEnd = rangeStart + perPage - 1;

  const term = sanitizeSearchTerm(filters.q?.trim() ?? '');
  const searchable = term.length >= 2;

  // Customers matching the term are resolved first so the search also covers
  // the customer name — still one extra query at most.
  let searchCustomerIds: string[] = [];
  if (searchable) {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('organization_id', organizationId)
      .ilike('name', `%${term}%`)
      .limit(50);

    searchCustomerIds = (data ?? []).map((row) => row.id);
  }

  let query = supabase
    .from('interventions')
    .select('*', { count: 'exact' })
    .eq('organization_id', organizationId);

  if (searchable) {
    const pattern = `%${term}%`;
    const clauses = [
      `reference.ilike.${pattern}`,
      `title.ilike.${pattern}`,
      `description.ilike.${pattern}`,
    ];
    if (searchCustomerIds.length > 0) {
      clauses.push(`customer_id.in.(${searchCustomerIds.join(',')})`);
    }
    query = query.or(clauses.join(','));
  }

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.priority) query = query.eq('priority', filters.priority);
  if (filters.technicianId) query = query.eq('technician_id', filters.technicianId);
  if (filters.customerId) query = query.eq('customer_id', filters.customerId);
  if (isDayKey(filters.from)) query = query.gte('scheduled_start', dayStartIso(filters.from));
  if (isDayKey(filters.to)) query = query.lte('scheduled_start', dayEndIso(filters.to));

  switch (filters.sort ?? 'recent') {
    case 'oldest':
      query = query.order('created_at', { ascending: true });
      break;
    case 'scheduled':
      query = query.order('scheduled_start', { ascending: true, nullsFirst: false });
      break;
    case 'priority':
      // The enum is declared low → urgent, so descending surfaces urgent first.
      query = query.order('priority', { ascending: false });
      break;
    case 'reference':
      query = query.order('reference', { ascending: false });
      break;
    default:
      query = query.order('created_at', { ascending: false });
  }

  // Stable tie-breaker so pagination never repeats or skips a row.
  query = query.order('id', { ascending: true });

  const { data, count, error } = await query.range(rangeStart, rangeEnd);
  if (error) throw error;

  const rawRows = data ?? [];
  const [customers, technicians] = await Promise.all([
    loadCustomerSummaries(
      supabase,
      organizationId,
      rawRows.map((row) => row.customer_id),
    ),
    loadTechnicianSummaries(
      supabase,
      organizationId,
      rawRows.flatMap((row) => (row.technician_id ? [row.technician_id] : [])),
    ),
  ]);

  const total = count ?? rawRows.length;

  return {
    rows: decorate(rawRows, customers, technicians),
    total,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
  };
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export interface InterventionDetail {
  intervention: InterventionRow;
  customer: CustomerRow | null;
  customerAddress: CustomerAddressRow | null;
  technician: TechnicianRow | null;
  photos: InterventionPhotoRow[];
  activity: ActivityLogRow[];
}

export async function getIntervention(
  organizationId: string,
  id: string,
): Promise<InterventionDetail | null> {
  const supabase = await createSupabaseServerClient();

  const { data: intervention, error } = await supabase
    .from('interventions')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!intervention) return null;

  const [customerResult, addressResult, technicianResult, photoResult, activityResult] =
    await Promise.all([
      supabase
        .from('customers')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('id', intervention.customer_id)
        .maybeSingle(),
      intervention.customer_address_id
        ? supabase
            .from('customer_addresses')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('id', intervention.customer_address_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      intervention.technician_id
        ? supabase
            .from('technicians')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('id', intervention.technician_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from('intervention_photos')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('intervention_id', intervention.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('activity_log')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('entity_type', INTERVENTION_ENTITY_TYPE)
        .eq('entity_id', intervention.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

  return {
    intervention,
    customer: customerResult.data ?? null,
    customerAddress: addressResult.data ?? null,
    technician: technicianResult.data ?? null,
    photos: photoResult.data ?? [],
    activity: activityResult.data ?? [],
  };
}

/**
 * History of every intervention of a customer, newest first. Used to show what
 * has already been delivered at a customer site.
 */
export async function getInterventionHistoryForCustomer(
  organizationId: string,
  customerId: string,
  limit = 25,
): Promise<InterventionListItem[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('interventions')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('customer_id', customerId)
    .order('scheduled_start', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(Math.min(100, Math.max(1, limit)));

  if (error) throw error;

  const rows = data ?? [];
  const technicians = await loadTechnicianSummaries(
    supabase,
    organizationId,
    rows.flatMap((row) => (row.technician_id ? [row.technician_id] : [])),
  );

  return decorate(rows, new Map(), technicians);
}

// ---------------------------------------------------------------------------
// Form options
// ---------------------------------------------------------------------------

export async function listCustomerOptions(
  organizationId: string,
  options: { includeArchived?: boolean } = {},
): Promise<CustomerOption[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase.from('customers').select('*').eq('organization_id', organizationId);
  if (!options.includeArchived) query = query.eq('status', 'active');

  const { data, error } = await query.order('name', { ascending: true }).limit(500);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status,
    email: row.email,
    phone: row.phone,
    address_line1: row.address_line1,
    address_line2: row.address_line2,
    postal_code: row.postal_code,
    city: row.city,
    country: row.country,
  }));
}

export async function listCustomerAddressOptions(
  organizationId: string,
  customerId?: string,
): Promise<CustomerAddressRow[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase.from('customer_addresses').select('*').eq('organization_id', organizationId);
  if (customerId) query = query.eq('customer_id', customerId);

  const { data, error } = await query
    .order('is_default', { ascending: false })
    .order('label', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function listTechnicianOptions(
  organizationId: string,
  options: { includeInactive?: boolean } = {},
): Promise<TechnicianOption[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase.from('technicians').select('*').eq('organization_id', organizationId);
  if (!options.includeInactive) query = query.eq('is_active', true);

  const { data, error } = await query.order('full_name', { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    full_name: row.full_name,
    color: row.color,
    status: row.status,
  }));
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

export interface InterventionPhotoWithUrl {
  photo: InterventionPhotoRow;
  /** `null` when signing failed (RLS or missing object). */
  url: string | null;
}

/** Short-lived signed URLs for a private bucket, obtained in a single call. */
export async function signInterventionPhotos(
  photos: InterventionPhotoRow[],
): Promise<InterventionPhotoWithUrl[]> {
  if (photos.length === 0) return [];

  const supabase = await createSupabaseServerClient();
  const bucket = photos[0]?.storage_bucket ?? INTERVENTION_PHOTO_BUCKET;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(
      photos.map((photo) => photo.storage_path),
      PHOTO_SIGNED_URL_TTL_SECONDS,
    );

  if (error || !data) return photos.map((photo) => ({ photo, url: null }));

  const byPath = new Map<string | null, string | null>(
    data.map((entry): [string | null, string | null] => [entry.path, entry.signedUrl]),
  );

  return photos.map((photo) => ({ photo, url: byPath.get(photo.storage_path) ?? null }));
}

