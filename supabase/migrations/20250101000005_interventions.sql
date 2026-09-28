-- ============================================================================
-- 0005_interventions
-- The core work order: who goes where, when, and what happened.
-- ============================================================================

create table if not exists public.interventions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reference text not null,
  reference_year integer not null default extract(year from now())::integer,
  customer_id uuid not null references public.customers (id) on delete restrict,
  customer_address_id uuid references public.customer_addresses (id) on delete set null,
  technician_id uuid references public.technicians (id) on delete set null,
  title text not null check (length(btrim(title)) between 2 and 160),
  description text,
  internal_notes text,
  status public.intervention_status not null default 'draft',
  priority public.intervention_priority not null default 'normal',
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  -- Address snapshot: kept even if the customer moves or is deleted.
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  country text default 'FR',
  completed_at timestamptz,
  cancelled_at timestamptz,
  completion_notes text,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, reference),
  constraint interventions_schedule_order check (
    scheduled_end is null or scheduled_start is null or scheduled_end >= scheduled_start
  )
);

create index if not exists interventions_org_idx on public.interventions (organization_id);
create index if not exists interventions_org_status_idx
  on public.interventions (organization_id, status);
create index if not exists interventions_org_scheduled_idx
  on public.interventions (organization_id, scheduled_start);
create index if not exists interventions_customer_idx on public.interventions (customer_id);
create index if not exists interventions_technician_idx on public.interventions (technician_id);
create index if not exists interventions_org_priority_idx
  on public.interventions (organization_id, priority);
create index if not exists interventions_title_trgm_idx
  on public.interventions using gin (title extensions.gin_trgm_ops);

comment on table public.interventions is
  'Work orders. Address columns are an immutable snapshot of the service location.';

-- --- triggers --------------------------------------------------------------

-- A technician can only be assigned work inside their own organisation.
create or replace function public.assert_intervention_relations()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer_org uuid;
  v_technician_org uuid;
  v_address_customer uuid;
begin
  select organization_id into v_customer_org
  from public.customers where id = new.customer_id;

  if v_customer_org is distinct from new.organization_id then
    raise exception 'cross_tenant_reference_blocked' using errcode = '42501';
  end if;

  if new.technician_id is not null then
    select organization_id into v_technician_org
    from public.technicians where id = new.technician_id;

    if v_technician_org is distinct from new.organization_id then
      raise exception 'cross_tenant_reference_blocked' using errcode = '42501';
    end if;
  end if;

  if new.customer_address_id is not null then
    select customer_id into v_address_customer
    from public.customer_addresses where id = new.customer_address_id;

    if v_address_customer is distinct from new.customer_id then
      raise exception 'address_does_not_belong_to_customer' using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists interventions_assert_relations on public.interventions;
create trigger interventions_assert_relations
  before insert or update of customer_id, technician_id, customer_address_id, organization_id
  on public.interventions
  for each row execute function public.assert_intervention_relations();

-- Keeps lifecycle timestamps consistent with the status.
create or replace function public.sync_intervention_lifecycle()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    case new.status
      when 'completed' then new.completed_at := coalesce(new.completed_at, now());
      when 'cancelled' then new.cancelled_at := coalesce(new.cancelled_at, now());
      else
        new.completed_at := null;
        new.cancelled_at := null;
    end case;
  end if;

  return new;
end;
$$;

drop trigger if exists interventions_sync_lifecycle on public.interventions;
create trigger interventions_sync_lifecycle
  before insert or update on public.interventions
  for each row execute function public.sync_intervention_lifecycle();

-- Human readable reference (INT-00001) assigned per organisation.
create or replace function public.assign_intervention_reference()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if nullif(btrim(coalesce(new.reference, '')), '') is null then
    new.reference := public.next_document_number(new.organization_id, 'intervention');
  end if;
  return new;
end;
$$;

drop trigger if exists interventions_assign_reference on public.interventions;
create trigger interventions_assign_reference
  before insert on public.interventions
  for each row execute function public.assign_intervention_reference();

drop trigger if exists interventions_set_updated_at on public.interventions;
create trigger interventions_set_updated_at
  before update on public.interventions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- intervention_photos (before / after evidence)
-- ---------------------------------------------------------------------------
create table if not exists public.intervention_photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  intervention_id uuid not null references public.interventions (id) on delete cascade,
  kind public.photo_kind not null default 'before',
  storage_bucket text not null default 'intervention-photos',
  storage_path text not null,
  file_name text,
  mime_type text,
  size_bytes integer check (size_bytes is null or size_bytes >= 0),
  caption text,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create index if not exists intervention_photos_org_idx
  on public.intervention_photos (organization_id);
create index if not exists intervention_photos_intervention_idx
  on public.intervention_photos (intervention_id, kind);

drop trigger if exists intervention_photos_same_org on public.intervention_photos;
create trigger intervention_photos_same_org
  before insert or update on public.intervention_photos
  for each row execute function public.assert_same_organization('interventions');

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.interventions enable row level security;
alter table public.intervention_photos enable row level security;

-- True when the current user is the technician assigned to an intervention.
create or replace function public.is_assigned_technician(p_intervention_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.interventions i
    join public.technicians t on t.id = i.technician_id
    where i.id = p_intervention_id
      and t.user_id = auth.uid()
  );
$$;

drop policy if exists interventions_select_member on public.interventions;
create policy interventions_select_member on public.interventions
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists interventions_insert_manager on public.interventions;
create policy interventions_insert_manager on public.interventions
  for insert to authenticated
  with check (public.can_manage_org_data(organization_id));

-- Technicians may progress their own interventions (status, notes, photos);
-- managers may edit everything.
drop policy if exists interventions_update_staff on public.interventions;
create policy interventions_update_staff on public.interventions
  for update to authenticated
  using (
    public.can_manage_org_data(organization_id)
    or public.is_assigned_technician(id)
  )
  with check (public.is_org_member(organization_id));

drop policy if exists interventions_delete_manager on public.interventions;
create policy interventions_delete_manager on public.interventions
  for delete to authenticated
  using (public.can_manage_org_data(organization_id));

drop policy if exists intervention_photos_select_member on public.intervention_photos;
create policy intervention_photos_select_member on public.intervention_photos
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists intervention_photos_insert_staff on public.intervention_photos;
create policy intervention_photos_insert_staff on public.intervention_photos
  for insert to authenticated
  with check (
    public.is_org_member(organization_id)
    and (public.can_manage_org_data(organization_id) or public.is_assigned_technician(intervention_id))
  );

drop policy if exists intervention_photos_update_staff on public.intervention_photos;
create policy intervention_photos_update_staff on public.intervention_photos
  for update to authenticated
  using (
    public.can_manage_org_data(organization_id)
    or public.is_assigned_technician(intervention_id)
    or uploaded_by = auth.uid()
  )
  with check (public.is_org_member(organization_id));

drop policy if exists intervention_photos_delete_staff on public.intervention_photos;
create policy intervention_photos_delete_staff on public.intervention_photos
  for delete to authenticated
  using (
    public.can_manage_org_data(organization_id)
    or uploaded_by = auth.uid()
  );

