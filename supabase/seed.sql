-- ============================================================================
-- seed.sql — optional demo dataset
--
-- Run it after the migrations (see docs/SETUP.md):
--   supabase db reset          (local: migrations + this file)
--   psql "$DATABASE_URL" -f supabase/seed.sql
--
-- Every row uses a deterministic UUID so the script is idempotent: re-running it
-- recreates the same demo organisation. Demo data lives in its own organisation
-- and is clearly labelled, so it never mixes with real records.
--
-- Attach the demo workspace to a real login afterwards:
--   select public.seed_demo_data('you@example.com');
-- ============================================================================

create or replace function public.seed_demo_data(p_email text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid := '0f000000-0000-4000-8000-000000000001';
  v_user uuid;
  v_today date := current_date;
  v_quote_a uuid := '9e000000-0000-4000-8000-000000000001';
  v_quote_b uuid := '9e000000-0000-4000-8000-000000000002';
  v_quote_c uuid := '9e000000-0000-4000-8000-000000000003';
  v_invoice_a uuid := '1f000000-0000-4000-8000-000000000001';
  v_invoice_b uuid := '1f000000-0000-4000-8000-000000000002';
begin
  if p_email is not null then
    select u.id into v_user
    from auth.users u
    where public.normalize_email(u.email) = public.normalize_email(p_email)
    limit 1;
  end if;

  -- Recreate from scratch on every run.
  delete from public.organizations where id = v_org or slug = 'demo-services';

  insert into public.organizations (
    id, name, slug, legal_name, email, phone, address_line1, postal_code, city, country,
    vat_number, registration_number, currency, default_vat_rate, payment_terms_days,
    timezone, quote_footer, invoice_footer, owner_id
  )
  values (
    v_org, 'Demo Services', 'demo-services', 'Demo Services SARL',
    'contact@demo-services.test', '+33 1 23 45 67 89', '12 rue des Artisans', '75011', 'Paris', 'FR',
    'FR12345678901', '81234567800019', 'EUR', 20.00, 30,
    'Europe/Paris',
    'Quote valid 30 days. Prices in EUR excluding VAT.',
    'Payment by bank transfer within 30 days. Late payment penalties apply.',
    v_user
  );

  if v_user is not null then
    insert into public.memberships (organization_id, user_id, role, status)
    values (v_org, v_user, 'admin', 'active')
    on conflict (organization_id, user_id) do update set role = 'admin', status = 'active';
  end if;

  -- ---------------------------------------------------------------- customers
  insert into public.customers (
    id, organization_id, type, status, first_name, last_name, company_name, contact_name,
    email, phone, mobile, vat_number, address_line1, postal_code, city, country, notes, tags, created_by
  )
  values
    ('c0000000-0000-4000-8000-000000000001', v_org, 'individual', 'active', 'Claire', 'Bernard', null, null,
     'claire.bernard@example.test', '+33 6 11 22 33 44', null, null, '5 rue Oberkampf', '75011', 'Paris', 'FR',
     'Prefers appointments in the afternoon.', array['residential'], v_user),
    ('c0000000-0000-4000-8000-000000000002', v_org, 'individual', 'active', 'Marc', 'Dubois', null, null,
     'marc.dubois@example.test', '+33 6 55 66 77 88', null, null, '18 avenue Jean Jaures', '69007', 'Lyon', 'FR',
     null, array['residential', 'vip'], v_user),
    ('c0000000-0000-4000-8000-000000000003', v_org, 'company', 'active', null, null, 'Residence Les Tilleuls', 'Sophie Martin',
     'gestion@les-tilleuls.test', '+33 1 44 55 66 77', null, 'FR98765432109', '3 allee des Tilleuls', '92100', 'Boulogne-Billancourt', 'FR',
     'Caretaker has the keys. Warn 24h in advance.', array['syndic', 'contract'], v_user),
    ('c0000000-0000-4000-8000-000000000004', v_org, 'company', 'active', null, null, 'Boulangerie Leon', 'Leon Petit',
     'contact@boulangerie-leon.test', '+33 1 98 76 54 32', null, null, '27 rue de la Roquette', '75011', 'Paris', 'FR',
     'Early morning availability only (before 8am).', array['commercial'], v_user),
    ('c0000000-0000-4000-8000-000000000005', v_org, 'company', 'active', null, null, 'Hotel du Parc', 'Nadia Haddad',
     'maintenance@hotel-du-parc.test', '+33 4 78 90 12 34', null, 'FR11223344556', '45 cours Gambetta', '69003', 'Lyon', 'FR',
     'On-site maintenance contract, monthly invoicing.', array['contract', 'hospitality'], v_user),
    ('c0000000-0000-4000-8000-000000000006', v_org, 'individual', 'archived', 'Julien', 'Moreau', null, null,
     null, '+33 7 12 34 56 78', null, null, '9 impasse des Lilas', '33000', 'Bordeaux', 'FR',
     'Moved out in spring.', array['residential'], v_user);

  -- ------------------------------------------------------- service addresses
  insert into public.customer_addresses (
    id, organization_id, customer_id, label, address_line1, address_line2, postal_code, city, country,
    access_notes, is_default
  )
  values
    ('ad000000-0000-4000-8000-000000000001', v_org, 'c0000000-0000-4000-8000-000000000003', 'Building A',
     '3 allee des Tilleuls', 'Batiment A', '92100', 'Boulogne-Billancourt', 'FR', 'Digicode 4A12.', true),
    ('ad000000-0000-4000-8000-000000000002', v_org, 'c0000000-0000-4000-8000-000000000003', 'Building B',
     '7 allee des Tilleuls', 'Batiment B', '92100', 'Boulogne-Billancourt', 'FR', 'Key from the caretaker.', false),
    ('ad000000-0000-4000-8000-000000000003', v_org, 'c0000000-0000-4000-8000-000000000005', 'Roof plant',
     '45 cours Gambetta', 'Rooftop access', '69003', 'Lyon', 'FR', 'Ask reception for the roof key.', true),
    ('ad000000-0000-4000-8000-000000000004', v_org, 'c0000000-0000-4000-8000-000000000004', 'Shop',
     '27 rue de la Roquette', null, '75011', 'Paris', 'FR', 'Service entrance at the back.', true);

  -- -------------------------------------------------------------- technicians
  insert into public.technicians (
    id, organization_id, user_id, full_name, email, phone, job_title, skills, status, color,
    hourly_rate, notes, is_active, created_by
  )
  values
    ('fe000000-0000-4000-8000-000000000001', v_org, v_user, 'Thomas Girard', 'thomas@demo-services.test',
     '+33 6 01 02 03 04', 'Senior plumber', array['plumbing', 'heating', 'boiler'], 'available', '#2563eb',
     42.00, 'Certified gas fitter.', true, v_user),
    ('fe000000-0000-4000-8000-000000000002', v_org, null, 'Sofia Lemaire', 'sofia@demo-services.test',
     '+33 6 05 06 07 08', 'Electrician', array['electrical', 'photovoltaic', 'network'], 'available', '#059669',
     45.50, null, true, v_user),
    ('fe000000-0000-4000-8000-000000000003', v_org, null, 'Karim Benali', 'karim@demo-services.test',
     '+33 6 09 10 11 12', 'HVAC technician', array['hvac', 'air conditioning', 'ventilation'], 'busy', '#d97706',
     40.00, null, true, v_user),
    ('fe000000-0000-4000-8000-000000000004', v_org, null, 'Elodie Rousseau', 'elodie@demo-services.test',
     '+33 6 13 14 15 16', 'Maintenance technician', array['cleaning', 'maintenance', 'painting'], 'on_leave', '#7c3aed',
     32.00, 'Back next Monday.', true, v_user);

  -- ------------------------------------------------------------ interventions
  -- Spread around today so the dashboard, the planning board and the upcoming
  -- list all have something to show. References are generated by the trigger.
  insert into public.interventions (
    id, organization_id, customer_id, customer_address_id, technician_id, title, description,
    status, priority, scheduled_start, scheduled_end, address_line1, postal_code, city, country,
    created_by, updated_by
  )
  values
    ('1a000000-0000-4000-8000-000000000001', v_org, 'c0000000-0000-4000-8000-000000000001', null,
     'fe000000-0000-4000-8000-000000000001', 'Leaking kitchen tap', 'Dripping mixer tap, bring a spare cartridge.',
     'scheduled', 'high', (v_today + interval '9 hours'), (v_today + interval '10 hours 30 minutes'),
     '5 rue Oberkampf', '75011', 'Paris', 'FR', v_user, v_user),
    ('1a000000-0000-4000-8000-000000000002', v_org, 'c0000000-0000-4000-8000-000000000003',
     'ad000000-0000-4000-8000-000000000001', 'fe000000-0000-4000-8000-000000000003',
     'Annual boiler service — Building A', 'Contractual yearly maintenance, 2 boilers.',
     'in_progress', 'normal', (v_today + interval '11 hours'), (v_today + interval '16 hours'),
     '3 allee des Tilleuls', '92100', 'Boulogne-Billancourt', 'FR', v_user, v_user),
    ('1a000000-0000-4000-8000-000000000003', v_org, 'c0000000-0000-4000-8000-000000000004', null,
     'fe000000-0000-4000-8000-000000000002', 'Replace bakery circuit breaker', 'Breaker trips when the ovens start.',
     'scheduled', 'urgent', (v_today + interval '7 hours'), (v_today + interval '8 hours 30 minutes'),
     '27 rue de la Roquette', '75011', 'Paris', 'FR', v_user, v_user),
    ('1a000000-0000-4000-8000-000000000004', v_org, 'c0000000-0000-4000-8000-000000000005',
     'ad000000-0000-4000-8000-000000000003', null, 'Air handling unit audit', 'Quarterly check of the rooftop AHU.',
     'draft', 'normal', null, null, '45 cours Gambetta', '69003', 'Lyon', 'FR', v_user, v_user),
    ('1a000000-0000-4000-8000-000000000005', v_org, 'c0000000-0000-4000-8000-000000000002', null,
     'fe000000-0000-4000-8000-000000000001', 'Radiator not heating', 'Second bedroom radiator stays cold.',
     'completed', 'normal', (v_today - interval '2 days' + interval '14 hours'),
     (v_today - interval '2 days' + interval '16 hours'),
     '18 avenue Jean Jaures', '69007', 'Lyon', 'FR', v_user, v_user),
    ('1a000000-0000-4000-8000-000000000006', v_org, 'c0000000-0000-4000-8000-000000000003',
     'ad000000-0000-4000-8000-000000000002', 'fe000000-0000-4000-8000-000000000002',
     'Stairwell lighting upgrade — Building B', 'Replace 12 fittings with LED.',
     'scheduled', 'normal', (v_today + interval '3 days' + interval '8 hours'),
     (v_today + interval '3 days' + interval '17 hours'),
     '7 allee des Tilleuls', '92100', 'Boulogne-Billancourt', 'FR', v_user, v_user),
    ('1a000000-0000-4000-8000-000000000007', v_org, 'c0000000-0000-4000-8000-000000000005',
     'ad000000-0000-4000-8000-000000000003', 'fe000000-0000-4000-8000-000000000003',
     'Air conditioning fault — rooms 201-210', 'Guest reports warm air only.',
     'scheduled', 'high', (v_today + interval '5 days' + interval '9 hours'),
     (v_today + interval '5 days' + interval '12 hours'),
     '45 cours Gambetta', '69003', 'Lyon', 'FR', v_user, v_user),
    ('1a000000-0000-4000-8000-000000000008', v_org, 'c0000000-0000-4000-8000-000000000001', null,
     null, 'Bathroom silicone renewal', 'Waiting for the customer to confirm the date.',
     'draft', 'low', (v_today + interval '12 days' + interval '10 hours'),
     (v_today + interval '12 days' + interval '12 hours'),
     '5 rue Oberkampf', '75011', 'Paris', 'FR', v_user, v_user),
    ('1a000000-0000-4000-8000-000000000009', v_org, 'c0000000-0000-4000-8000-000000000004', null,
     'fe000000-0000-4000-8000-000000000004', 'Deep clean of the sales area', 'Scheduled after closing time.',
     'cancelled', 'low', (v_today - interval '6 days' + interval '20 hours'),
     (v_today - interval '6 days' + interval '22 hours'),
     '27 rue de la Roquette', '75011', 'Paris', 'FR', v_user, v_user);

  update public.interventions
    set completion_notes = 'Thermostatic valve replaced, radiator bled and balanced.',
        completed_at = now() - interval '2 days'
    where id = '1a000000-0000-4000-8000-000000000005';


  -- ------------------------------------------------------------------ quotes
  insert into public.quotes (
    id, organization_id, quote_number, customer_id, intervention_id, status, issue_date, valid_until,
    currency, discount_type, discount_value, notes, created_by, updated_by
  )
  values
    (v_quote_a, v_org, 'QUO-00001', 'c0000000-0000-4000-8000-000000000005',
     '1a000000-0000-4000-8000-000000000007', 'accepted', v_today - 12, v_today + 18, 'EUR',
     'percentage', 5, 'Air conditioning repair after the diagnostic visit.', v_user, v_user),
    (v_quote_b, v_org, 'QUO-00002', 'c0000000-0000-4000-8000-000000000003',
     '1a000000-0000-4000-8000-000000000006', 'sent', v_today - 4, v_today + 26, 'EUR',
     'none', 0, 'LED upgrade with a 5-year warranty.', v_user, v_user),
    (v_quote_c, v_org, 'QUO-00003', 'c0000000-0000-4000-8000-000000000002',
     null, 'draft', v_today, v_today + 30, 'EUR', 'none', 0, 'Full bathroom renovation estimate.', v_user, v_user);

  insert into public.quote_items (
    organization_id, quote_id, position, description, unit, quantity, unit_price, vat_rate, discount_percent
  )
  values
    (v_org, v_quote_a, 0, 'Diagnostic and fault finding', 'hour', 2, 75.00, 20.00, 0),
    (v_org, v_quote_a, 1, 'Compressor replacement', 'unit', 1, 1450.00, 20.00, 0),
    (v_org, v_quote_a, 2, 'Refrigerant recharge R410A', 'kg', 3.5, 95.00, 20.00, 0),
    (v_org, v_quote_b, 0, 'LED fitting supply and installation', 'unit', 12, 68.00, 20.00, 0),
    (v_org, v_quote_b, 1, 'Cable and accessories', 'flat rate', 1, 210.00, 20.00, 10),
    (v_org, v_quote_c, 0, 'Demolition and disposal', 'flat rate', 1, 850.00, 10.00, 0),
    (v_org, v_quote_c, 1, 'Sanitary ware supply', 'flat rate', 1, 2200.00, 20.00, 0),
    (v_org, v_quote_c, 2, 'Labour', 'day', 6, 380.00, 20.00, 0);

  -- ---------------------------------------------------------------- invoices
  insert into public.invoices (
    id, organization_id, invoice_number, customer_id, intervention_id, quote_id, status,
    issue_date, due_date, currency, discount_type, discount_value, notes, payment_terms,
    amount_paid, created_by, updated_by
  )
  values
    (v_invoice_a, v_org, 'INV-00001', 'c0000000-0000-4000-8000-000000000002',
     '1a000000-0000-4000-8000-000000000005', null, 'paid', v_today - 2, v_today + 28, 'EUR',
     'none', 0, 'Radiator repair, parts and labour.', 'Payment within 30 days.',
     243.60, v_user, v_user),
    (v_invoice_b, v_org, 'INV-00002', 'c0000000-0000-4000-8000-000000000004', null, null, 'sent',
     v_today - 40, v_today - 10, 'EUR', 'none', 0,
     'Emergency call-out and circuit breaker replacement.', 'Payment within 30 days.', 0, v_user, v_user);

  insert into public.invoice_items (
    organization_id, invoice_id, position, description, unit, quantity, unit_price, vat_rate, discount_percent
  )
  values
    (v_org, v_invoice_a, 0, 'Intervention — radiator not heating', 'hour', 1.5, 65.00, 20.00, 0),
    (v_org, v_invoice_a, 1, 'Thermostatic valve', 'unit', 1, 138.00, 20.00, 0),
    (v_org, v_invoice_b, 0, 'Emergency call-out (evening)', 'flat rate', 1, 180.00, 20.00, 0),
    (v_org, v_invoice_b, 1, 'Circuit breaker 32A', 'unit', 1, 42.00, 20.00, 0),
    (v_org, v_invoice_b, 2, 'Labour (before opening hours)', 'hour', 2, 78.00, 20.00, 0);

  -- Recompute the stored totals from the line items (the triggers also do this
  -- on insert; this keeps the seed explicit and self-checking).
  perform public.recalculate_document_totals('quote', v_quote_a);
  perform public.recalculate_document_totals('quote', v_quote_b);
  perform public.recalculate_document_totals('quote', v_quote_c);
  perform public.recalculate_document_totals('invoice', v_invoice_a);
  perform public.recalculate_document_totals('invoice', v_invoice_b);

  update public.invoices set status = 'paid', paid_at = now() - interval '1 day'
  where id = v_invoice_a;


  -- ----------------------------------------------------------- activity feed
  insert into public.activity_log (
    organization_id, actor_id, actor_name, action, entity_type, entity_id, entity_label, summary, created_at
  )
  values
    (v_org, v_user, 'Demo administrator', 'created', 'organization', v_org, 'Demo Services',
     'Created the Demo Services organisation', now() - interval '30 days'),
    (v_org, v_user, 'Demo administrator', 'created', 'intervention',
     '1a000000-0000-4000-8000-000000000002', 'Annual boiler service',
     'Scheduled the annual boiler service', now() - interval '3 days'),
    (v_org, v_user, 'Demo administrator', 'status_changed', 'intervention',
     '1a000000-0000-4000-8000-000000000005', 'Radiator not heating',
     'Marked intervention INT-00005 as completed', now() - interval '2 days'),
    (v_org, v_user, 'Demo administrator', 'created', 'invoice', v_invoice_a, 'INV-00001',
     'Issued invoice INV-00001', now() - interval '2 days'),
    (v_org, v_user, 'Demo administrator', 'status_changed', 'quote', v_quote_a, 'QUO-00001',
     'Customer accepted quote QUO-00001', now() - interval '9 days');

  raise notice 'Demo organisation ready (id = %).', v_org;

  return v_org;
end;
$$;

comment on function public.seed_demo_data(text) is
  'Development helper: (re)creates a demo organisation with customers, technicians, interventions, quotes and invoices.';

-- ---------------------------------------------------------------------------
-- Auto-run on `supabase db reset`
--
-- Attaches the demo workspace to the first existing profile when there is one;
-- otherwise it is created unowned and can be claimed later with
-- `select public.seed_demo_data('you@example.com');`
-- ---------------------------------------------------------------------------
do $$
declare
  v_email text;
  v_org uuid;
begin
  select u.email into v_email
  from public.profiles p
  join auth.users u on u.id = p.id
  order by p.created_at
  limit 1;

  v_org := public.seed_demo_data(v_email);

  if v_email is null then
    raise notice
      'Demo data created without an owner. Sign up first, then run: select public.seed_demo_data(''you@example.com'');';
  else
    raise notice 'Demo data attached to % (organisation %).', v_email, v_org;
  end if;
end
$$;

