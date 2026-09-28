-- ============================================================================
-- 0004_technicians
-- Field technicians (optionally linked to an application user) of an org.
-- ============================================================================

create table if not exists public.technicians (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  full_name text not null check (length(btrim(full_name)) between 2 and 120),
  email text,
  phone text,
  job_title text,
  skills text[] not null default '{}',
  status public.technician_status not null default 'available',
  color text not null default '#2563eb' check (color ~* '^#[0-9a-f]{6}$'),
  hourly_rate numeric(10, 2) check (hourly_rate is null or hourly_rate >= 0),
  notes text,
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists technicians_org_idx on public.technicians (organization_id);
create index if not exists technicians_org_status_idx
  on public.technicians (organization_id, status);
create index if not exists technicians_name_trgm_idx
  on public.technicians using gin (full_name extensions.gin_trgm_ops);
create index if not exists technicians_skills_idx on public.technicians using gin (skills);

comment on table public.technicians is
  'Field staff of an organisation. `user_id` links a technician to a login when they have one.';

drop trigger if exists technicians_set_updated_at on public.technicians;
create trigger technicians_set_updated_at
  before update on public.technicians
  for each row execute function public.set_updated_at();

-- A technician linked to a login must belong to the same organisation as that
-- login's membership.
create or replace function public.assert_technician_user_membership()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.user_id is not null
     and not exists (
       select 1
       from public.memberships m
       where m.organization_id = new.organization_id
         and m.user_id = new.user_id
     ) then
    raise exception 'technician_user_not_member_of_organization' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists technicians_assert_membership on public.technicians;
create trigger technicians_assert_membership
  before insert or update of user_id, organization_id on public.technicians
  for each row execute function public.assert_technician_user_membership();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.technicians enable row level security;

drop policy if exists technicians_select_member on public.technicians;
create policy technicians_select_member on public.technicians
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists technicians_insert_manager on public.technicians;
create policy technicians_insert_manager on public.technicians
  for insert to authenticated
  with check (public.can_manage_org_data(organization_id));

drop policy if exists technicians_update_manager on public.technicians;
create policy technicians_update_manager on public.technicians
  for update to authenticated
  using (public.can_manage_org_data(organization_id) or user_id = auth.uid())
  with check (public.can_manage_org_data(organization_id) or user_id = auth.uid());

drop policy if exists technicians_delete_manager on public.technicians;
create policy technicians_delete_manager on public.technicians
  for delete to authenticated
  using (public.can_manage_org_data(organization_id));
