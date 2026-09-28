-- ============================================================================
-- 0007_quotes
-- Quotes (devis) with line items, per-line VAT/discount and document totals.
-- ============================================================================

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  quote_number text not null,
  customer_id uuid not null references public.customers (id) on delete restrict,
  intervention_id uuid references public.interventions (id) on delete set null,
  status public.quote_status not null default 'draft',
  issue_date date not null default current_date,
  valid_until date,
  currency text not null default 'EUR' check (char_length(currency) = 3),
  discount_type public.discount_type not null default 'none',
  discount_value numeric(14, 2) not null default 0 check (discount_value >= 0),
  notes text,
  internal_notes text,
  subtotal numeric(14, 2) not null default 0,
  discount_total numeric(14, 2) not null default 0,
  net_total numeric(14, 2) not null default 0,
  vat_total numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  sent_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  -- FK added in migration 0008 (invoices are created after quotes).
  converted_invoice_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, quote_number),
  constraint quotes_validity_order check (valid_until is null or valid_until >= issue_date),
  constraint quotes_discount_shape check (
    (discount_type = 'percentage' and discount_value <= 100) or discount_type <> 'percentage'
  )
);

create index if not exists quotes_org_idx on public.quotes (organization_id);
create index if not exists quotes_org_status_idx on public.quotes (organization_id, status);
create index if not exists quotes_org_issue_date_idx on public.quotes (organization_id, issue_date desc);
create index if not exists quotes_customer_idx on public.quotes (customer_id);
create index if not exists quotes_number_trgm_idx
  on public.quotes using gin (quote_number extensions.gin_trgm_ops);

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  quote_id uuid not null references public.quotes (id) on delete cascade,
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

create index if not exists quote_items_org_idx on public.quote_items (organization_id);
create index if not exists quote_items_quote_idx on public.quote_items (quote_id, position);

comment on table public.quotes is 'Commercial proposals. Totals are maintained by database triggers.';
comment on column public.quote_items.line_total is 'Net line amount (excl. VAT) after line discount.';

drop trigger if exists quotes_set_updated_at on public.quotes;
create trigger quotes_set_updated_at
  before update on public.quotes
  for each row execute function public.set_updated_at();

drop trigger if exists quote_items_set_updated_at on public.quote_items;
create trigger quote_items_set_updated_at
  before update on public.quote_items
  for each row execute function public.set_updated_at();

drop trigger if exists quotes_same_org_customer on public.quotes;
create trigger quotes_same_org_customer
  before insert or update on public.quotes
  for each row execute function public.assert_same_organization('customers');

drop trigger if exists quote_items_same_org on public.quote_items;
create trigger quote_items_same_org
  before insert or update on public.quote_items
  for each row execute function public.assert_same_organization('quotes');

-- ---------------------------------------------------------------------------
-- Money engine
--
-- Both `quotes` and `invoices` share the exact same line item model, so the
-- calculations live in two generic functions used by both tables:
--
--   compute_document_line_totals()  -> BEFORE INSERT/UPDATE on *items
--   recalculate_document_totals()   -> AFTER INSERT/UPDATE/DELETE on *items
--
-- Rounding contract (mirrored in src/lib/domain/totals.ts and unit tested):
--   line_subtotal = round(quantity * unit_price, 2)
--   line_discount = round(line_subtotal * discount_percent / 100, 2)
--   line_total    = line_subtotal - line_discount          (net, excl. VAT)
--   line_vat      = round(line_total * vat_rate / 100, 2)
--   document.net_total = sum(line_total) - global_discount
--   document.vat_total = round(sum(line_vat) * net_total / sum(line_total), 2)
--   document.total     = net_total + vat_total
-- ---------------------------------------------------------------------------

create or replace function public.compute_document_line_totals()
returns trigger
language plpgsql
as $$
declare
  v_subtotal numeric(14, 2);
  v_discount numeric(14, 2);
  v_net numeric(14, 2);
begin
  v_subtotal := round(coalesce(new.quantity, 0) * coalesce(new.unit_price, 0), 2);
  v_discount := round(v_subtotal * coalesce(new.discount_percent, 0) / 100, 2);
  v_net := v_subtotal - v_discount;

  new.line_subtotal := v_subtotal;
  new.line_discount := v_discount;
  new.line_total := v_net;
  new.line_vat := round(v_net * coalesce(new.vat_rate, 0) / 100, 2);

  return new;
end;
$$;

create or replace function public.recalculate_document_totals(
  p_kind public.document_kind,
  p_document_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_items_table text;
  v_items_fk text;
  v_docs_table text;
  v_subtotal numeric(14, 2);
  v_item_discount numeric(14, 2);
  v_vat_sum numeric(14, 2);
  v_net_sum numeric(14, 2);
  v_discount_type public.discount_type;
  v_discount_value numeric(14, 2);
  v_organization_id uuid;
  v_global_discount numeric(14, 2) := 0;
  v_net numeric(14, 2);
  v_vat numeric(14, 2);
  v_total numeric(14, 2);
begin
  if p_kind = 'quote' then
    v_items_table := 'quote_items';
    v_items_fk := 'quote_id';
    v_docs_table := 'quotes';
  elsif p_kind = 'invoice' then
    v_items_table := 'invoice_items';
    v_items_fk := 'invoice_id';
    v_docs_table := 'invoices';
  else
    raise exception 'unsupported_document_kind: %', p_kind using errcode = '22023';
  end if;

  if p_document_id is null then
    return;
  end if;

  execute format(
    'select discount_type, discount_value, organization_id from public.%I where id = $1',
    v_docs_table
  )
  into v_discount_type, v_discount_value, v_organization_id
  using p_document_id;

  -- Document was deleted: nothing to update.
  if v_organization_id is null then
    return;
  end if;

  execute format(
    'select coalesce(sum(line_subtotal), 0), coalesce(sum(line_discount), 0),
            coalesce(sum(line_vat), 0), coalesce(sum(line_total), 0)
       from public.%I where %I = $1',
    v_items_table,
    v_items_fk
  )
  into v_subtotal, v_item_discount, v_vat_sum, v_net_sum
  using p_document_id;

  if v_discount_type = 'percentage' then
    v_global_discount := round(v_net_sum * coalesce(v_discount_value, 0) / 100, 2);
  elsif v_discount_type = 'fixed' then
    v_global_discount := least(coalesce(v_discount_value, 0), v_net_sum);
  end if;

  v_net := v_net_sum - v_global_discount;
  v_vat := case when v_net_sum > 0 then round(v_vat_sum * v_net / v_net_sum, 2) else 0 end;
  v_total := v_net + v_vat;

  execute format(
    'update public.%I
        set subtotal = $2,
            discount_total = $3,
            net_total = $4,
            vat_total = $5,
            total = $6
      where id = $1',
    v_docs_table
  )
  using p_document_id, v_subtotal, v_item_discount + v_global_discount, v_net, v_vat, v_total;
end;
$$;

-- Generic item trigger reused by quote_items and invoice_items.
create or replace function public.trg_recalculate_document_totals()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_new_parent uuid;
  v_old_parent uuid;
  v_kind public.document_kind;
begin
  v_kind := case tg_table_name
    when 'quote_items' then 'quote'::public.document_kind
    else 'invoice'::public.document_kind
  end;

  if tg_op <> 'DELETE' then
    v_new_parent := coalesce(new.quote_id, new.invoice_id);
  end if;

  if tg_op <> 'INSERT' then
    v_old_parent := coalesce(old.quote_id, old.invoice_id);
  end if;

  perform public.recalculate_document_totals(v_kind, v_new_parent);

  if v_old_parent is distinct from v_new_parent then
    perform public.recalculate_document_totals(v_kind, v_old_parent);
  end if;

  return null;
end;
$$;


drop trigger if exists quote_items_compute_totals on public.quote_items;
create trigger quote_items_compute_totals
  before insert or update on public.quote_items
  for each row execute function public.compute_document_line_totals();

drop trigger if exists quote_items_recalculate_totals on public.quote_items;
create trigger quote_items_recalculate_totals
  after insert or update or delete on public.quote_items
  for each row execute function public.trg_recalculate_document_totals();

-- Re-run the calculation when the document level discount changes.
drop trigger if exists quotes_recalculate_totals on public.quotes;
create trigger quotes_recalculate_totals
  after update of discount_type, discount_value on public.quotes
  for each row execute function public.recalculate_document_totals('quote', new.id);

-- Quote number (QUO-00001) and lifecycle timestamps.
create or replace function public.assign_quote_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if nullif(btrim(coalesce(new.quote_number, '')), '') is null then
    new.quote_number := public.next_document_number(new.organization_id, 'quote');
  end if;
  return new;
end;
$$;

drop trigger if exists quotes_assign_number on public.quotes;
create trigger quotes_assign_number
  before insert on public.quotes
  for each row execute function public.assign_quote_number();

create or replace function public.sync_quote_lifecycle()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    case new.status
      when 'sent' then
        new.sent_at := coalesce(new.sent_at, now());
      when 'accepted' then
        new.sent_at := coalesce(new.sent_at, now());
        new.accepted_at := coalesce(new.accepted_at, now());
      when 'rejected' then
        new.sent_at := coalesce(new.sent_at, now());
        new.rejected_at := coalesce(new.rejected_at, now());
      else
        null;
    end case;
  end if;

  return new;
end;
$$;

drop trigger if exists quotes_sync_lifecycle on public.quotes;
create trigger quotes_sync_lifecycle
  before insert or update on public.quotes
  for each row execute function public.sync_quote_lifecycle();

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Quotes and their lines are commercially sensitive: any member may read them,
-- only admins/managers may write.
-- ---------------------------------------------------------------------------
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;

drop policy if exists quotes_select_member on public.quotes;
create policy quotes_select_member on public.quotes
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists quotes_insert_manager on public.quotes;
create policy quotes_insert_manager on public.quotes
  for insert to authenticated
  with check (public.can_manage_org_data(organization_id));

drop policy if exists quotes_update_manager on public.quotes;
create policy quotes_update_manager on public.quotes
  for update to authenticated
  using (public.can_manage_org_data(organization_id))
  with check (public.can_manage_org_data(organization_id));

drop policy if exists quotes_delete_manager on public.quotes;
create policy quotes_delete_manager on public.quotes
  for delete to authenticated
  using (public.can_manage_org_data(organization_id));

drop policy if exists quote_items_select_member on public.quote_items;
create policy quote_items_select_member on public.quote_items
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists quote_items_insert_manager on public.quote_items;
create policy quote_items_insert_manager on public.quote_items
  for insert to authenticated
  with check (public.can_manage_org_data(organization_id));

drop policy if exists quote_items_update_manager on public.quote_items;
create policy quote_items_update_manager on public.quote_items
  for update to authenticated
  using (public.can_manage_org_data(organization_id))
  with check (public.can_manage_org_data(organization_id));

drop policy if exists quote_items_delete_manager on public.quote_items;
create policy quote_items_delete_manager on public.quote_items
  for delete to authenticated
  using (public.can_manage_org_data(organization_id));

