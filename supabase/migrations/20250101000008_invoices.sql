-- ============================================================================
-- 0008_invoices
-- Invoices, their line items, payment tracking and the "generate from
-- quote / intervention" business logic.
-- ============================================================================

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  invoice_number text not null,
  customer_id uuid not null references public.customers (id) on delete restrict,
  intervention_id uuid references public.interventions (id) on delete set null,
  quote_id uuid references public.quotes (id) on delete set null,
  status public.invoice_status not null default 'draft',
  issue_date date not null default current_date,
  due_date date,
  currency text not null default 'EUR' check (char_length(currency) = 3),
  discount_type public.discount_type not null default 'none',
  discount_value numeric(14, 2) not null default 0 check (discount_value >= 0),
  notes text,
  internal_notes text,
  payment_terms text,
  payment_method text,
  subtotal numeric(14, 2) not null default 0,
  discount_total numeric(14, 2) not null default 0,
  net_total numeric(14, 2) not null default 0,
  vat_total numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  amount_paid numeric(14, 2) not null default 0 check (amount_paid >= 0),
  sent_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, invoice_number),
  constraint invoices_due_date_order check (due_date is null or due_date >= issue_date),
  constraint invoices_discount_shape check (
    (discount_type = 'percentage' and discount_value <= 100) or discount_type <> 'percentage'
  )
);

create index if not exists invoices_org_idx on public.invoices (organization_id);
create index if not exists invoices_org_status_idx on public.invoices (organization_id, status);
create index if not exists invoices_org_issue_date_idx
  on public.invoices (organization_id, issue_date desc);
create index if not exists invoices_org_due_date_idx on public.invoices (organization_id, due_date);
create index if not exists invoices_customer_idx on public.invoices (customer_id);
create index if not exists invoices_number_trgm_idx
  on public.invoices using gin (invoice_number extensions.gin_trgm_ops);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  position integer not null default 0,
  description text not null check (length(btrim(description)) between 1 and 500),
  unit text not null default 'unit',
  quantity numeric(12, 3) not null default 1 check (quantity >= 0),
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0),
  vat_rate numeric(5, 2) not null default 20.00 check (vat_rate between 0 and 100),
  discount_percent numeric(5, 2) not null default 0 check (discount_percent between 0 and 100),
  line_subtotal numeric(14, 2) not null default 0,
  line_discount numeric(14, 2) not null default 0,
  line_vat numeric(14, 2) not null default 0,
  line_total numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoice_items_org_idx on public.invoice_items (organization_id);
create index if not exists invoice_items_invoice_idx on public.invoice_items (invoice_id, position);

comment on table public.invoices is
  'Invoices. Totals come from triggers, payment status is derived from amount_paid vs total.';

-- Back-reference: quotes that have been invoiced.
alter table public.quotes
  drop constraint if exists quotes_converted_invoice_id_fkey;
alter table public.quotes
  add constraint quotes_converted_invoice_id_fkey
  foreign key (converted_invoice_id) references public.invoices (id) on delete set null;

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

drop trigger if exists invoice_items_set_updated_at on public.invoice_items;
create trigger invoice_items_set_updated_at
  before update on public.invoice_items
  for each row execute function public.set_updated_at();

drop trigger if exists invoices_same_org_customer on public.invoices;
create trigger invoices_same_org_customer
  before insert or update on public.invoices
  for each row execute function public.assert_same_organization('customers');

drop trigger if exists invoice_items_same_org on public.invoice_items;
create trigger invoice_items_same_org
  before insert or update on public.invoice_items
  for each row execute function public.assert_same_organization('invoices');

-- ---------------------------------------------------------------------------
-- Invoices: relations, numbering, payment state and totals
-- ---------------------------------------------------------------------------

-- Quote / intervention links must belong to the same organisation.
create or replace function public.assert_invoice_relations()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
begin
  if new.quote_id is not null then
    select organization_id into v_org from public.quotes where id = new.quote_id;
    if v_org is distinct from new.organization_id then
      raise exception 'cross_tenant_reference_blocked' using errcode = '42501';
    end if;
  end if;

  if new.intervention_id is not null then
    select organization_id into v_org from public.interventions where id = new.intervention_id;
    if v_org is distinct from new.organization_id then
      raise exception 'cross_tenant_reference_blocked' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists invoices_assert_relations on public.invoices;
create trigger invoices_assert_relations
  before insert or update of quote_id, intervention_id, organization_id on public.invoices
  for each row execute function public.assert_invoice_relations();

-- Invoice number (INV-00001).
create or replace function public.assign_invoice_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if nullif(btrim(coalesce(new.invoice_number, '')), '') is null then
    new.invoice_number := public.next_document_number(new.organization_id, 'invoice');
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_assign_number on public.invoices;
create trigger invoices_assign_number
  before insert on public.invoices
  for each row execute function public.assign_invoice_number();

-- Payment state is derived from `amount_paid` vs `total` so the UI can never
-- drift from the money columns. An explicitly cancelled invoice stays cancelled.
create or replace function public.sync_invoice_payment_state()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'cancelled' then
    new.cancelled_at := coalesce(new.cancelled_at, now());
    return new;
  end if;

  if new.total > 0 and new.amount_paid >= new.total then
    new.status := 'paid';
    new.paid_at := coalesce(new.paid_at, now());
  elsif new.amount_paid > 0 then
    new.status := 'partial';
    new.paid_at := null;
  elsif new.status in ('paid', 'partial', 'overdue') then
    new.status := case
      when new.due_date is not null and new.due_date < current_date then 'overdue'
      else 'sent'
    end;
    new.paid_at := null;
  end if;

  if new.status = 'sent' and new.sent_at is null then
    new.sent_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists invoices_sync_payment_state on public.invoices;
create trigger invoices_sync_payment_state
  before insert or update on public.invoices
  for each row execute function public.sync_invoice_payment_state();

drop trigger if exists invoice_items_compute_totals on public.invoice_items;
create trigger invoice_items_compute_totals
  before insert or update on public.invoice_items
  for each row execute function public.compute_document_line_totals();

drop trigger if exists invoice_items_recalculate_totals on public.invoice_items;
create trigger invoice_items_recalculate_totals
  after insert or update or delete on public.invoice_items
  for each row execute function public.trg_recalculate_document_totals();

drop trigger if exists invoices_recalculate_totals on public.invoices;
create trigger invoices_recalculate_totals
  after update of discount_type, discount_value on public.invoices
  for each row execute function public.recalculate_document_totals('invoice', new.id);

-- Flags invoices that have passed their due date without being fully paid.
-- Intended to be scheduled (pg_cron / Supabase scheduled function); the UI
-- also derives "overdue" at read time so nothing depends on the job running.
create or replace function public.mark_overdue_invoices()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.invoices
    set status = 'overdue'
    where status = 'sent'
      and due_date is not null
      and due_date < current_date
      and amount_paid < total;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


-- ---------------------------------------------------------------------------
-- Invoice generation
--
-- Implemented as SECURITY DEFINER functions so header + lines + counter
-- update happen in a single transaction, and so the numbering can never be
-- raced by two concurrent requests.
-- ---------------------------------------------------------------------------

create or replace function public.create_invoice_from_quote(
  p_quote_id uuid,
  p_issue_date date default null,
  p_due_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_quote public.quotes%rowtype;
  v_terms integer;
  v_issue date := coalesce(p_issue_date, current_date);
  v_invoice_id uuid;
begin
  if v_user is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select * into v_quote from public.quotes where id = p_quote_id for update;

  if not found then
    raise exception 'quote_not_found' using errcode = '22023';
  end if;

  if not public.can_manage_org_data(v_quote.organization_id) then
    raise exception 'insufficient_privileges' using errcode = '42501';
  end if;

  if v_quote.status <> 'accepted' then
    raise exception 'quote_must_be_accepted' using errcode = '22023';
  end if;

  select payment_terms_days into v_terms
  from public.organizations where id = v_quote.organization_id;

  insert into public.invoices (
    organization_id, customer_id, quote_id, intervention_id,
    issue_date, due_date, currency, discount_type, discount_value,
    notes, status, created_by, updated_by
  )
  values (
    v_quote.organization_id, v_quote.customer_id, v_quote.id, v_quote.intervention_id,
    v_issue, coalesce(p_due_date, v_issue + coalesce(v_terms, 30)), v_quote.currency,
    v_quote.discount_type, v_quote.discount_value,
    v_quote.notes, 'draft', v_user, v_user
  )
  returning id into v_invoice_id;

  insert into public.invoice_items (
    organization_id, invoice_id, position, description, unit,
    quantity, unit_price, vat_rate, discount_percent
  )
  select
    qi.organization_id, v_invoice_id, qi.position, qi.description, qi.unit,
    qi.quantity, qi.unit_price, qi.vat_rate, qi.discount_percent
  from public.quote_items qi
  where qi.quote_id = p_quote_id
  order by qi.position, qi.created_at;

  -- Totals are recomputed by the item triggers; make sure an empty quote
  -- still ends up with a valid header row.
  perform public.recalculate_document_totals('invoice', v_invoice_id);

  update public.quotes
    set converted_invoice_id = v_invoice_id,
        updated_by = v_user
    where id = p_quote_id;

  return v_invoice_id;
end;
$$;

create or replace function public.create_invoice_from_intervention(
  p_intervention_id uuid,
  p_issue_date date default null,
  p_due_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_intervention public.interventions%rowtype;
  v_org public.organizations%rowtype;
  v_quote_id uuid;
  v_issue date := coalesce(p_issue_date, current_date);
  v_invoice_id uuid;
begin
  if v_user is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select * into v_intervention
  from public.interventions where id = p_intervention_id for update;

  if not found then
    raise exception 'intervention_not_found' using errcode = '22023';
  end if;

  if not public.can_manage_org_data(v_intervention.organization_id) then
    raise exception 'insufficient_privileges' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.invoices i
    where i.intervention_id = p_intervention_id and i.status <> 'cancelled'
  ) then
    raise exception 'invoice_already_exists_for_intervention' using errcode = '23505';
  end if;

  -- Prefer billing the accepted quote linked to this intervention.
  select q.id into v_quote_id
  from public.quotes q
  where q.intervention_id = p_intervention_id
    and q.status = 'accepted'
    and q.converted_invoice_id is null
  order by q.accepted_at desc nulls last, q.created_at desc
  limit 1;

  if v_quote_id is not null then
    return public.create_invoice_from_quote(v_quote_id, p_issue_date, p_due_date);
  end if;

  select * into v_org from public.organizations where id = v_intervention.organization_id;

  insert into public.invoices (
    organization_id, customer_id, intervention_id, issue_date, due_date,
    currency, notes, status, created_by, updated_by
  )
  values (
    v_intervention.organization_id, v_intervention.customer_id, v_intervention.id,
    v_issue, coalesce(p_due_date, v_issue + coalesce(v_org.payment_terms_days, 30)),
    v_org.currency, null, 'draft', v_user, v_user
  )
  returning id into v_invoice_id;

  insert into public.invoice_items (
    organization_id, invoice_id, position, description, unit, quantity, unit_price, vat_rate
  )
  values (
    v_intervention.organization_id, v_invoice_id, 0,
    format('Intervention %s — %s', v_intervention.reference, v_intervention.title),
    'forfait', 1, 0, v_org.default_vat_rate
  );

  return v_invoice_id;
end;
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.create_invoice_from_quote(uuid, date, date) to authenticated';
    execute 'grant execute on function public.create_invoice_from_intervention(uuid, date, date) to authenticated';
    execute 'grant execute on function public.accept_invitation(text) to authenticated';
    execute 'grant execute on function public.create_organization(text, text, text) to authenticated';
    execute 'grant execute on function public.mark_overdue_invoices() to authenticated';
  end if;
end
$$;


-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

drop policy if exists invoices_select_member on public.invoices;
create policy invoices_select_member on public.invoices
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists invoices_insert_manager on public.invoices;
create policy invoices_insert_manager on public.invoices
  for insert to authenticated
  with check (public.can_manage_org_data(organization_id));

drop policy if exists invoices_update_manager on public.invoices;
create policy invoices_update_manager on public.invoices
  for update to authenticated
  using (public.can_manage_org_data(organization_id))
  with check (public.can_manage_org_data(organization_id));

-- Accounting documents are never hard-deleted by technicians; managers may
-- delete drafts (further restriction is enforced in the application layer).
drop policy if exists invoices_delete_manager on public.invoices;
create policy invoices_delete_manager on public.invoices
  for delete to authenticated
  using (public.can_manage_org_data(organization_id));

drop policy if exists invoice_items_select_member on public.invoice_items;
create policy invoice_items_select_member on public.invoice_items
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists invoice_items_insert_manager on public.invoice_items;
create policy invoice_items_insert_manager on public.invoice_items
  for insert to authenticated
  with check (public.can_manage_org_data(organization_id));

drop policy if exists invoice_items_update_manager on public.invoice_items;
create policy invoice_items_update_manager on public.invoice_items
  for update to authenticated
  using (public.can_manage_org_data(organization_id))
  with check (public.can_manage_org_data(organization_id));

drop policy if exists invoice_items_delete_manager on public.invoice_items;
create policy invoice_items_delete_manager on public.invoice_items
  for delete to authenticated
  using (public.can_manage_org_data(organization_id));

