-- ============================================================================
-- 0003_customers
-- Customer (individual or company) records plus their service addresses.
-- ============================================================================

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  type public.customer_type not null default 'individual',
  status public.customer_status not null default 'active',
  -- individual
  first_name text,
  last_name text,
  -- company
  company_name text,
  contact_name text,
  -- derived display name, maintained by trigger
  name text not null default '',
  email text,
  phone text,
  mobile text,
  website text,
  vat_number text,
  registration_number text,
  -- primary/billing address kept inline: it is needed on every document
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  country text default 'FR',
  notes text,
  tags text[] not null default '{}',
  created_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_name_present check (
    case type
      when 'company' then nullif(btrim(company_name), '') is not null
      else nullif(btrim(first_name), '') is not null
        or nullif(btrim(last_name), '') is not null
    end
  ),
  constraint customers_email_shape check (
    email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  )
);

create index if not exists customers_org_idx on public.customers (organization_id);
create index if not exists customers_org_status_idx on public.customers (organization_id, status);
create index if not exists customers_name_trgm_idx
  on public.customers using gin (name extensions.gin_trgm_ops);
create index if not exists customers_email_trgm_idx
  on public.customers using gin (email extensions.gin_trgm_ops);
create index if not exists customers_phone_trgm_idx
  on public.customers using gin (phone extensions.gin_trgm_ops);
create index if not exists customers_tags_idx on public.customers using gin (tags);

comment on table public.customers is
  'Tenant-owned customer records. `name` is a derived display name kept in sync by trigger.';

-- Keeps the searchable display name in sync with the type-specific fields.
create or replace function public.sync_customer_display_name()
returns trigger
language plpgsql
as $$
begin
  if new.type = 'company' then
    new.name := coalesce(nullif(btrim(new.company_name), ''), nullif(btrim(new.contact_name), ''), '');
  else
    new.name := btrim(
      coalesce(nullif(btrim(new.first_name), ''), '') ||
      case
        when nullif(btrim(new.first_name), '') is not null
             and nullif(btrim(new.last_name), '') is not null then ' '
        else ''
      end ||
      coalesce(nullif(btrim(new.last_name), ''), '')
    );
  end if;

  if new.status = 'archived' then
    new.archived_at := coalesce(new.archived_at, now());
  else
    new.archived_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists customers_sync_display_name on public.customers;
create trigger customers_sync_display_name
  before insert or update on public.customers
  for each row execute function public.sync_customer_display_name();

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- customer_addresses (service sites: "the flat on 3rd floor", "warehouse B")
-- ---------------------------------------------------------------------------
create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  label text not null default 'Site principal',
  address_line1 text not null,
  address_line2 text,
  postal_code text,
  city text,
  country text default 'FR',
  access_notes text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_addresses_org_idx on public.customer_addresses (organization_id);
create index if not exists customer_addresses_customer_idx
  on public.customer_addresses (customer_id);
create unique index if not exists customer_addresses_one_default_idx
  on public.customer_addresses (customer_id) where is_default;

drop trigger if exists customer_addresses_set_updated_at on public.customer_addresses;
create trigger customer_addresses_set_updated_at
  before update on public.customer_addresses
  for each row execute function public.set_updated_at();

-- A tenant-tagged address row can never point at a customer of another tenant.
create or replace function public.assert_same_organization()
returns trigger
language plpgsql
as $$
declare
  v_child_org uuid;
begin
  execute format('select organization_id from public.%I where id = $1', tg_argv[0])
    into v_child_org
    using new.customer_id;

  if v_child_org is distinct from new.organization_id then
    raise exception 'cross_tenant_reference_blocked' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists customer_addresses_same_org on public.customer_addresses;
create trigger customer_addresses_same_org
  before insert or update on public.customer_addresses
  for each row execute function public.assert_same_organization('customers');

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Read: any active member of the organisation (technicians need the address
--       to actually show up on site).
-- Write: administrators and managers only.
-- ---------------------------------------------------------------------------
alter table public.customers enable row level security;
alter table public.customer_addresses enable row level security;

drop policy if exists customers_select_member on public.customers;
create policy customers_select_member on public.customers
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists customers_insert_manager on public.customers;
create policy customers_insert_manager on public.customers
  for insert to authenticated
  with check (public.can_manage_org_data(organization_id) and created_by = auth.uid());

drop policy if exists customers_update_manager on public.customers;
create policy customers_update_manager on public.customers
  for update to authenticated
  using (public.can_manage_org_data(organization_id))
  with check (public.can_manage_org_data(organization_id));

drop policy if exists customers_delete_manager on public.customers;
create policy customers_delete_manager on public.customers
  for delete to authenticated
  using (public.can_manage_org_data(organization_id));

drop policy if exists customer_addresses_select_member on public.customer_addresses;
create policy customer_addresses_select_member on public.customer_addresses
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists customer_addresses_insert_manager on public.customer_addresses;
create policy customer_addresses_insert_manager on public.customer_addresses
  for insert to authenticated
  with check (public.can_manage_org_data(organization_id));

drop policy if exists customer_addresses_update_manager on public.customer_addresses;
create policy customer_addresses_update_manager on public.customer_addresses
  for update to authenticated
  using (public.can_manage_org_data(organization_id))
  with check (public.can_manage_org_data(organization_id));

drop policy if exists customer_addresses_delete_manager on public.customer_addresses;
create policy customer_addresses_delete_manager on public.customer_addresses
  for delete to authenticated
  using (public.can_manage_org_data(organization_id));

