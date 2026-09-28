-- ============================================================================
-- 0009_activity_and_reporting
-- Append-only activity feed + aggregated dashboard queries.
-- ============================================================================

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  actor_name text,
  action public.activity_action not null,
  entity_type text not null check (length(btrim(entity_type)) between 2 and 60),
  entity_id uuid,
  entity_label text,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_org_created_idx
  on public.activity_log (organization_id, created_at desc);
create index if not exists activity_log_entity_idx
  on public.activity_log (organization_id, entity_type, entity_id);

comment on table public.activity_log is
  'Append-only audit/activity trail shown on the dashboard and detail pages.';

-- Fire-and-forget helper the application calls after a successful mutation.
create or replace function public.log_activity(
  p_organization_id uuid,
  p_action public.activity_action,
  p_entity_type text,
  p_entity_id uuid,
  p_entity_label text,
  p_summary text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_name text;
  v_id uuid;
begin
  if v_user is not null and not public.is_org_member(p_organization_id) then
    raise exception 'not_a_member_of_organization' using errcode = '42501';
  end if;

  select p.full_name into v_name from public.profiles p where p.id = v_user;

  insert into public.activity_log (
    organization_id, actor_id, actor_name, action, entity_type, entity_id,
    entity_label, summary, metadata
  )
  values (
    p_organization_id, v_user, v_name, p_action, p_entity_type, p_entity_id,
    p_entity_label, p_summary, coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

alter table public.activity_log enable row level security;

drop policy if exists activity_log_select_member on public.activity_log;
create policy activity_log_select_member on public.activity_log
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists activity_log_insert_member on public.activity_log;
create policy activity_log_insert_member on public.activity_log
  for insert to authenticated
  with check (public.is_org_member(organization_id) and (actor_id is null or actor_id = auth.uid()));

-- The feed is immutable for everyone except administrators (GDPR erasure).
drop policy if exists activity_log_delete_admin on public.activity_log;
create policy activity_log_delete_admin on public.activity_log
  for delete to authenticated
  using (public.is_org_admin(organization_id));

-- ---------------------------------------------------------------------------
-- Dashboard aggregates
--
-- One round trip instead of a dozen COUNT queries. The function is SECURITY
-- INVOKER on purpose: RLS still applies to every table it reads, on top of the
-- explicit membership guard below.
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_summary(
  p_organization_id uuid,
  p_today date default current_date
)
returns table (
  interventions_today bigint,
  interventions_upcoming bigint,
  interventions_in_progress bigint,
  interventions_unassigned bigint,
  interventions_to_invoice bigint,
  pending_quotes bigint,
  pending_quotes_amount numeric,
  unpaid_invoices bigint,
  unpaid_invoices_amount numeric,
  overdue_invoices bigint,
  revenue_this_month numeric,
  revenue_last_month numeric,
  revenue_last_30_days numeric,
  active_customers bigint,
  active_technicians bigint
)
language plpgsql
stable
set search_path = public, pg_temp
as $$
begin
  if not public.is_org_member(p_organization_id) then
    raise exception 'not_a_member_of_organization' using errcode = '42501';
  end if;

  return query
  select
    (
      select count(*) from public.interventions i
      where i.organization_id = p_organization_id
        and i.status <> 'cancelled'
        and i.scheduled_start >= p_today::timestamptz
        and i.scheduled_start < (p_today + 1)::timestamptz
    ),
    (
      select count(*) from public.interventions i
      where i.organization_id = p_organization_id
        and i.status in ('draft', 'scheduled')
        and i.scheduled_start >= (p_today + 1)::timestamptz
    ),
    (
      select count(*) from public.interventions i
      where i.organization_id = p_organization_id and i.status = 'in_progress'
    ),
    (
      select count(*) from public.interventions i
      where i.organization_id = p_organization_id
        and i.technician_id is null
        and i.status in ('draft', 'scheduled')
    ),
    (
      select count(*) from public.interventions i
      where i.organization_id = p_organization_id
        and i.status = 'completed'
        and not exists (
          select 1 from public.invoices inv
          where inv.intervention_id = i.id and inv.status <> 'cancelled'
        )
    ),
    (
      select count(*) from public.quotes q
      where q.organization_id = p_organization_id and q.status in ('draft', 'sent')
    ),
    (
      select coalesce(sum(q.total), 0) from public.quotes q
      where q.organization_id = p_organization_id and q.status in ('draft', 'sent')
    ),
    (
      select count(*) from public.invoices inv
      where inv.organization_id = p_organization_id
        and inv.status in ('sent', 'partial', 'overdue')
    ),
    (
      select coalesce(sum(inv.total - inv.amount_paid), 0) from public.invoices inv
      where inv.organization_id = p_organization_id
        and inv.status in ('sent', 'partial', 'overdue')
    ),
    (
      select count(*) from public.invoices inv
      where inv.organization_id = p_organization_id
        and inv.status in ('sent', 'partial', 'overdue')
        and inv.due_date is not null
        and inv.due_date < p_today
    ),
    (
      select coalesce(sum(inv.total), 0) from public.invoices inv
      where inv.organization_id = p_organization_id
        and inv.status <> 'cancelled'
        and inv.issue_date >= date_trunc('month', p_today)::date
        and inv.issue_date < (date_trunc('month', p_today) + interval '1 month')::date
    ),
    (
      select coalesce(sum(inv.total), 0) from public.invoices inv
      where inv.organization_id = p_organization_id
        and inv.status <> 'cancelled'
        and inv.issue_date >= (date_trunc('month', p_today) - interval '1 month')::date
        and inv.issue_date < date_trunc('month', p_today)::date
    ),
    (
      select coalesce(sum(inv.total), 0) from public.invoices inv
      where inv.organization_id = p_organization_id
        and inv.status <> 'cancelled'
        and inv.issue_date >= (p_today - 29)
        and inv.issue_date <= p_today
    ),
    (
      select count(*) from public.customers c
      where c.organization_id = p_organization_id and c.status = 'active'
    ),
    (
      select count(*) from public.technicians t
      where t.organization_id = p_organization_id
        and t.is_active
        and t.status <> 'inactive'
    );
end;
$$;


-- Monthly revenue series for the dashboard chart (last N months).
create or replace function public.revenue_by_month(
  p_organization_id uuid,
  p_months integer default 6
)
returns table (month_start date, invoiced numeric, paid numeric)
language plpgsql
stable
set search_path = public, pg_temp
as $$
begin
  if not public.is_org_member(p_organization_id) then
    raise exception 'not_a_member_of_organization' using errcode = '42501';
  end if;

  return query
  select
    m.month_start,
    coalesce((
      select sum(inv.total) from public.invoices inv
      where inv.organization_id = p_organization_id
        and inv.status <> 'cancelled'
        and inv.issue_date >= m.month_start
        and inv.issue_date < (m.month_start + interval '1 month')::date
    ), 0)::numeric as invoiced,
    coalesce((
      select sum(inv.amount_paid) from public.invoices inv
      where inv.organization_id = p_organization_id
        and inv.status <> 'cancelled'
        and inv.issue_date >= m.month_start
        and inv.issue_date < (m.month_start + interval '1 month')::date
    ), 0)::numeric as paid
  from (
    select (date_trunc('month', current_date) - (n || ' months')::interval)::date as month_start
    from generate_series(greatest(p_months, 1) - 1, 0, -1) as n
  ) m
  order by m.month_start;
end;
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.dashboard_summary(uuid, date) to authenticated';
    execute 'grant execute on function public.revenue_by_month(uuid, integer) to authenticated';
    execute 'grant execute on function public.log_activity(uuid, public.activity_action, text, uuid, text, text, jsonb) to authenticated';
    execute 'grant execute on function public.peek_document_number(uuid, public.document_kind) to authenticated';
    execute 'grant execute on function public.current_user_organizations() to authenticated';
  end if;
end
$$;

