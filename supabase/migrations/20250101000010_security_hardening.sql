-- ============================================================================
-- 0010_security_hardening
-- Final safety net: assert RLS coverage, tighten grants, expose an audit view.
-- ============================================================================

-- Every tenant-scoped table must have RLS enabled. The loop below is
-- idempotent and makes a missing `enable row level security` impossible to
-- ship silently.
do $$
declare
  v_table text;
  v_tables text[] := array[
    'organizations',
    'profiles',
    'memberships',
    'organization_invitations',
    'document_sequences',
    'customers',
    'customer_addresses',
    'technicians',
    'interventions',
    'intervention_photos',
    'quotes',
    'quote_items',
    'invoices',
    'invoice_items',
    'activity_log'
  ];
begin
  foreach v_table in array v_tables loop
    if exists (
      select 1 from pg_tables where schemaname = 'public' and tablename = v_table
    ) then
      execute format('alter table public.%I enable row level security', v_table);
      -- NOTE: 'force row level security' is intentionally NOT used: the table owner
      -- (postgres) must stay able to run migrations and seed scripts.
    else
      raise exception 'expected table public.% is missing', v_table;
    end if;
  end loop;
end
$$;

-- Grants: authenticated users get table privileges (RLS still filters rows),
-- anon gets nothing at all.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant usage on schema public to authenticated;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant usage, select on all sequences in schema public to authenticated;
    grant execute on all functions in schema public to authenticated;

    if exists (select 1 from pg_roles where rolname = 'anon') then
      revoke all on all tables in schema public from anon;
      revoke execute on all functions in schema public from anon;
    end if;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Operational audit helpers
-- ---------------------------------------------------------------------------

-- Lists every tenant-scoped table with its RLS state and policy count.
-- Useful before/after a deployment: `select * from public.rls_coverage();`
create or replace function public.rls_coverage()
returns table (table_name text, rls_enabled boolean, policy_count bigint)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select
    c.relname::text as table_name,
    c.relrowsecurity as rls_enabled,
    (select count(*) from pg_policy p where p.polrelid = c.oid) as policy_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and exists (
      select 1 from information_schema.columns col
      where col.table_schema = 'public'
        and col.table_name = c.relname
        and col.column_name = 'organization_id'
    )
  order by c.relname;
$$;

comment on function public.rls_coverage() is
  'Ops helper: every row with rls_enabled = false needs attention immediately.';

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.rls_coverage() to service_role';
  end if;

  -- rls_coverage() is a legitimate ops tool but should not be callable by
  -- regular tenant users.
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke execute on function public.rls_coverage() from authenticated';
    execute 'revoke execute on function public.rls_coverage() from anon';
  end if;
exception
  when undefined_function then
    null;
end
$$;
