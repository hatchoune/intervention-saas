-- ============================================================================
-- 0002_organizations_and_people
-- Organisations (tenants), user profiles, memberships and invitations.
--
-- Tenancy model: every tenant-owned row carries `organization_id` and is
-- protected by an RLS policy calling `public.is_org_member(organization_id)`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- organisations
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  legal_name text,
  email text,
  phone text,
  website text,
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  country text default 'FR',
  vat_number text,
  registration_number text,
  logo_url text,
  currency text not null default 'EUR' check (char_length(currency) = 3),
  default_vat_rate numeric(5, 2) not null default 20.00 check (default_vat_rate between 0 and 100),
  payment_terms_days integer not null default 30 check (payment_terms_days between 0 and 365),
  timezone text not null default 'Europe/Paris',
  quote_footer text,
  invoice_footer text,
  owner_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.organizations is 'Tenant root: one row per service business.';

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  job_title text,
  avatar_url text,
  locale text not null default 'fr',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Application profile mirroring auth.users.';

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile whenever a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(coalesce(new.email, 'utilisateur'), '@', 1)
    ),
    nullif(btrim(new.raw_user_meta_data ->> 'phone'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- memberships (user <-> organisation, carries the role)
-- ---------------------------------------------------------------------------
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.organization_role not null default 'technician',
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists memberships_user_idx on public.memberships (user_id);
create index if not exists memberships_org_idx on public.memberships (organization_id);

drop trigger if exists memberships_set_updated_at on public.memberships;
create trigger memberships_set_updated_at
  before update on public.memberships
  for each row execute function public.set_updated_at();

-- Never allow an organisation to end up without an active admin.
create or replace function public.protect_last_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid := coalesce(old.organization_id, new.organization_id);
  v_remaining integer;
begin
  if (tg_op = 'DELETE' and old.role = 'admin' and old.status = 'active')
     or (tg_op = 'UPDATE' and old.role = 'admin' and old.status = 'active'
         and (new.role <> 'admin' or new.status <> 'active')) then
    select count(*) into v_remaining
    from public.memberships
    where organization_id = v_org
      and role = 'admin'
      and status = 'active'
      and id <> old.id;

    if v_remaining = 0 then
      raise exception 'organization_requires_an_admin' using errcode = '23514';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists memberships_protect_last_admin on public.memberships;
create trigger memberships_protect_last_admin
  before update or delete on public.memberships
  for each row execute function public.protect_last_admin();

-- ---------------------------------------------------------------------------
-- organization_invitations
-- ---------------------------------------------------------------------------
create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role public.organization_role not null default 'technician',
  status public.invitation_status not null default 'pending',
  token text not null unique default public.generate_token(24),
  invited_by uuid references auth.users (id) on delete set null,
  accepted_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organization_invitations_org_idx
  on public.organization_invitations (organization_id);
create index if not exists organization_invitations_email_idx
  on public.organization_invitations (public.normalize_email(email));

drop trigger if exists organization_invitations_set_updated_at on public.organization_invitations;
create trigger organization_invitations_set_updated_at
  before update on public.organization_invitations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- document_sequences: attach the FK now that organisations exist
-- ---------------------------------------------------------------------------
alter table public.document_sequences
  drop constraint if exists document_sequences_organization_id_fkey;
alter table public.document_sequences
  add constraint document_sequences_organization_id_fkey
  foreign key (organization_id) references public.organizations (id) on delete cascade;


-- ---------------------------------------------------------------------------
-- Onboarding RPCs
-- ---------------------------------------------------------------------------

-- Strips accents without requiring the unaccent extension.
create or replace function public.strip_accents(p_value text)
returns text
language sql
immutable
as $$
  select translate(
    p_value,
    'áàâäãåÁÀÂÄÃÅéèêëÉÈÊËíìîïÍÌÎÏóòôöõÓÒÔÖÕúùûüÚÙÛÜçÇñÑýÿÝ',
    'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnNyyY'
  );
$$;

-- Slugifies an organisation name.
create or replace function public.slugify(p_value text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(
        lower(public.strip_accents(coalesce(p_value, ''))),
        '[^a-z0-9]+',
        '-',
        'g'
      )),
      ''
    ),
    'org'
  );
$$;

create or replace function public.unique_organization_slug(p_name text)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_base text := public.slugify(p_name);
  v_candidate text := v_base;
  v_suffix integer := 1;
begin
  while exists (select 1 from public.organizations o where o.slug = v_candidate) loop
    v_suffix := v_suffix + 1;
    v_candidate := v_base || '-' || v_suffix::text;
  end loop;
  return v_candidate;
end;
$$;

-- Creates an organisation and makes the caller its first administrator.
-- Called right after sign-up (or from the onboarding screen).
create or replace function public.create_organization(
  p_name text,
  p_country text default null,
  p_currency text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_org_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if v_user is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if length(v_name) < 2 then
    raise exception 'organization_name_too_short' using errcode = '22023';
  end if;

  insert into public.organizations (name, slug, owner_id, country, currency)
  values (
    left(v_name, 120),
    public.unique_organization_slug(v_name),
    v_user,
    coalesce(nullif(btrim(p_country), ''), 'FR'),
    upper(coalesce(nullif(btrim(p_currency), ''), 'EUR'))
  )
  returning id into v_org_id;

  insert into public.memberships (organization_id, user_id, role, status)
  values (v_org_id, v_user, 'admin', 'active')
  on conflict (organization_id, user_id)
  do update set role = 'admin', status = 'active';

  return v_org_id;
end;
$$;

-- Redeems an invitation token for the signed-in user.
-- The invitation e-mail must match the authenticated user's e-mail and the
-- token must still be pending and unexpired.
create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_invitation public.organization_invitations%rowtype;
begin
  if v_user is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select public.normalize_email(u.email) into v_email
  from auth.users u
  where u.id = v_user;

  select * into v_invitation
  from public.organization_invitations i
  where i.token = p_token
    and i.status = 'pending'
  for update;

  if not found then
    raise exception 'invitation_not_found' using errcode = '22023';
  end if;

  if v_invitation.expires_at < now() then
    update public.organization_invitations
      set status = 'expired'
      where id = v_invitation.id;
    raise exception 'invitation_expired' using errcode = '22023';
  end if;

  if public.normalize_email(v_invitation.email) is distinct from v_email then
    raise exception 'invitation_email_mismatch' using errcode = '42501';
  end if;

  insert into public.memberships (organization_id, user_id, role, status)
  values (v_invitation.organization_id, v_user, v_invitation.role, 'active')
  on conflict (organization_id, user_id)
  do update set role = excluded.role, status = 'active';

  update public.organization_invitations
    set status = 'accepted',
        accepted_at = now(),
        accepted_by = v_user
    where id = v_invitation.id;

  return v_invitation.organization_id;
end;
$$;

-- Marks invitations as expired. Intended for a scheduled job (pg_cron) but
-- harmless to call manually; also exposed so the UI stays correct.
create or replace function public.expire_stale_invitations()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.organization_invitations
    set status = 'expired'
    where status = 'pending'
      and expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.document_sequences enable row level security;

-- organisations ------------------------------------------------------------
drop policy if exists organizations_select_member on public.organizations;
create policy organizations_select_member on public.organizations
  for select to authenticated
  using (public.is_org_member(id));

drop policy if exists organizations_insert_authenticated on public.organizations;
create policy organizations_insert_authenticated on public.organizations
  for insert to authenticated
  with check (auth.uid() is not null and owner_id = auth.uid());

drop policy if exists organizations_update_admin on public.organizations;
create policy organizations_update_admin on public.organizations
  for update to authenticated
  using (public.is_org_admin(id))
  with check (public.is_org_admin(id));

drop policy if exists organizations_delete_admin on public.organizations;
create policy organizations_delete_admin on public.organizations
  for delete to authenticated
  using (public.is_org_admin(id));

-- profiles -----------------------------------------------------------------
drop policy if exists profiles_select_self_or_colleague on public.profiles;
create policy profiles_select_self_or_colleague on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_organization_with(id));

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- memberships --------------------------------------------------------------
drop policy if exists memberships_select_member on public.memberships;
create policy memberships_select_member on public.memberships
  for select to authenticated
  using (user_id = auth.uid() or public.is_org_member(organization_id));

drop policy if exists memberships_insert_admin on public.memberships;
create policy memberships_insert_admin on public.memberships
  for insert to authenticated
  with check (public.is_org_admin(organization_id));

drop policy if exists memberships_update_admin on public.memberships;
create policy memberships_update_admin on public.memberships
  for update to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists memberships_delete_admin on public.memberships;
create policy memberships_delete_admin on public.memberships
  for delete to authenticated
  using (public.is_org_admin(organization_id));

-- organization_invitations -------------------------------------------------
drop policy if exists invitations_select_admin on public.organization_invitations;
create policy invitations_select_admin on public.organization_invitations
  for select to authenticated
  using (public.is_org_admin(organization_id));

drop policy if exists invitations_insert_admin on public.organization_invitations;
create policy invitations_insert_admin on public.organization_invitations
  for insert to authenticated
  with check (public.is_org_admin(organization_id) and invited_by = auth.uid());

drop policy if exists invitations_update_admin on public.organization_invitations;
create policy invitations_update_admin on public.organization_invitations
  for update to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists invitations_delete_admin on public.organization_invitations;
create policy invitations_delete_admin on public.organization_invitations
  for delete to authenticated
  using (public.is_org_admin(organization_id));

-- document_sequences -------------------------------------------------------
-- Read-only for members; numbers are only ever written through the
-- SECURITY DEFINER helper functions.
drop policy if exists document_sequences_select_member on public.document_sequences;
create policy document_sequences_select_member on public.document_sequences
  for select to authenticated
  using (public.is_org_member(organization_id));

