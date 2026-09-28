-- ============================================================================
-- 0001_foundation
-- Extensions, enum types, shared helper functions and generic triggers.
--
-- This migration must run before every other migration in this folder.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create schema if not exists extensions;

-- Trigram indexes power the "search" inputs of the customer / intervention
-- lists without requiring an external search service.
create extension if not exists pg_trgm with schema extensions;

-- Used for cryptographically random invitation tokens.
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'organization_role') then
    create type public.organization_role as enum ('admin', 'manager', 'technician');
  end if;

  if not exists (select 1 from pg_type where typname = 'membership_status') then
    create type public.membership_status as enum ('invited', 'active', 'suspended');
  end if;

  if not exists (select 1 from pg_type where typname = 'invitation_status') then
    create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');
  end if;

  if not exists (select 1 from pg_type where typname = 'customer_type') then
    create type public.customer_type as enum ('individual', 'company');
  end if;

  if not exists (select 1 from pg_type where typname = 'customer_status') then
    create type public.customer_status as enum ('active', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'technician_status') then
    create type public.technician_status as enum ('available', 'busy', 'on_leave', 'inactive');
  end if;

  if not exists (select 1 from pg_type where typname = 'intervention_status') then
    create type public.intervention_status as enum
      ('draft', 'scheduled', 'in_progress', 'completed', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'intervention_priority') then
    create type public.intervention_priority as enum ('low', 'normal', 'high', 'urgent');
  end if;

  if not exists (select 1 from pg_type where typname = 'photo_kind') then
    create type public.photo_kind as enum ('before', 'after');
  end if;

  if not exists (select 1 from pg_type where typname = 'quote_status') then
    create type public.quote_status as enum ('draft', 'sent', 'accepted', 'rejected', 'expired');
  end if;

  if not exists (select 1 from pg_type where typname = 'invoice_status') then
    create type public.invoice_status as enum
      ('draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled');

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------

-- Keeps `updated_at` columns honest without relying on the application.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Safe text -> uuid cast used by storage policies where the object path is
-- fully user controlled. Returns null instead of raising on malformed input.
create or replace function public.safe_uuid(p_value text)
returns uuid
language plpgsql
immutable
as $$
begin
  return p_value::uuid;
exception
  when others then
    return null;
end;
$$;

-- Normalises user supplied e-mail addresses for case-insensitive matching.
create or replace function public.normalize_email(p_value text)
returns text
language sql
immutable
as $$
  select nullif(lower(btrim(coalesce(p_value, ''))), '');
$$;

-- Generates a random URL-safe token (used for organisation invitations).
create or replace function public.generate_token(p_bytes integer default 24)
returns text
language sql
volatile
as $$
  select replace(
    replace(encode(extensions.gen_random_bytes(p_bytes), 'base64'), '/', '_'),
    '+',
    '-'
  );
$$;

-- ---------------------------------------------------------------------------
-- Tenant membership helpers
--
-- These are SECURITY DEFINER so that RLS policies on `memberships` never
-- recurse into themselves. `search_path` is pinned to defeat search_path
-- hijacking inside a definer function.
-- ---------------------------------------------------------------------------

create or replace function public.is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = p_organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.has_org_role(
  p_organization_id uuid,
  p_roles public.organization_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = p_organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any (p_roles)
  );
$$;

create or replace function public.is_org_admin(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_org_role(p_organization_id, array['admin']::public.organization_role[]);
$$;

-- True when the current user may manage day-to-day operational data
-- (customers, interventions, quotes, invoices) of the organisation.
create or replace function public.can_manage_org_data(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_org_role(
    p_organization_id,
    array['admin', 'manager']::public.organization_role[]
  );
$$;

-- Used by the `profiles` policies so members of the same organisation can see
-- each other's name/avatar (needed for activity feeds and technician assignment).
create or replace function public.shares_organization_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = auth.uid()
      and mine.status = 'active'
      and theirs.user_id = p_user_id
  );
$$;

-- Organisations the current user may see (used by the org switcher).
create or replace function public.current_user_organizations()
returns table (organization_id uuid, role public.organization_role, name text, slug text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select o.id, m.role, o.name, o.slug
  from public.memberships m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = auth.uid()
    and m.status = 'active'
  order by o.name;
$$;

  end if;

  if not exists (select 1 from pg_type where typname = 'document_kind') then
    create type public.document_kind as enum ('intervention', 'quote', 'invoice');
  end if;

  if not exists (select 1 from pg_type where typname = 'discount_type') then
    create type public.discount_type as enum ('none', 'percentage', 'fixed');
  end if;

  if not exists (select 1 from pg_type where typname = 'activity_action') then
    create type public.activity_action as enum ('created', 'updated', 'deleted', 'status_changed');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Document numbering
--
-- Per-organisation, atomic counters for intervention references, quote numbers
-- and invoice numbers. Numbers are assigned by triggers (see the module
-- migrations) so they stay unique even under concurrent writes.
-- ---------------------------------------------------------------------------

create table if not exists public.document_sequences (
  organization_id uuid not null,
  kind public.document_kind not null,
  prefix text not null default '',
  last_number integer not null default 0,
  width smallint not null default 5 check (width between 1 and 12),
  updated_at timestamptz not null default now(),
  primary key (organization_id, kind)
);

comment on table public.document_sequences is
  'Per-organisation monotonic counters used to generate reference/number strings.';

create or replace function public.default_document_prefix(p_kind public.document_kind)
returns text
language sql
immutable
as $$
  select case p_kind
    when 'intervention' then 'INT-'
    when 'quote' then 'QUO-'
    when 'invoice' then 'INV-'
  end;
$$;

create or replace function public.next_document_number(
  p_organization_id uuid,
  p_kind public.document_kind
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prefix text;
  v_number integer;
  v_width smallint;
begin
  -- Trusted server-side contexts (service_role, migrations, seed scripts)
  -- have no auth.uid(); anything else must be a member of the organisation.
  if auth.uid() is not null and not public.is_org_member(p_organization_id) then
    raise exception 'not_a_member_of_organization' using errcode = '42501';
  end if;

  insert into public.document_sequences (organization_id, kind, prefix, last_number)
  values (p_organization_id, p_kind, public.default_document_prefix(p_kind), 1)
  on conflict (organization_id, kind) do update
    set last_number = public.document_sequences.last_number + 1,
        updated_at = now()
  returning prefix, last_number, width
  into v_prefix, v_number, v_width;

  return v_prefix || lpad(v_number::text, v_width, '0');
end;
$$;

-- Non-mutating preview of the next number (used by the UI on "new" forms).
create or replace function public.peek_document_number(
  p_organization_id uuid,
  p_kind public.document_kind
)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_prefix text;
  v_number integer;
  v_width smallint;
begin
  if auth.uid() is not null and not public.is_org_member(p_organization_id) then
    raise exception 'not_a_member_of_organization' using errcode = '42501';
  end if;

  select prefix, last_number + 1, width
  into v_prefix, v_number, v_width
  from public.document_sequences
  where organization_id = p_organization_id and kind = p_kind;

  if v_prefix is null then
    v_prefix := public.default_document_prefix(p_kind);
    v_number := 1;
    v_width := 5;
  end if;

  return v_prefix || lpad(v_number::text, v_width, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- Grant hardening
--
-- Supabase ships default privileges for the anon/authenticated roles; we
-- re-assert them explicitly and make sure `anon` can never read tenant data
-- (every table additionally has RLS enabled).
-- Wrapped in a DO block so the migration also runs on vanilla PostgreSQL.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant usage on schema public to authenticated';
    execute 'revoke all on all tables in schema public from anon';
  end if;
end
$$;

