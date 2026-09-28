# FieldFlow — field service management for small service businesses

A multi-tenant SaaS application for SMEs that manage field interventions: plumbers,
electricians, HVAC companies, maintenance contractors, cleaning and repair businesses.

Plan the week, dispatch technicians, keep customer history, quote with VAT and turn
completed work into numbered, print-ready invoices — with tenant isolation enforced in
the database itself.

```text
Next.js 16 (App Router, React 19, Server Components & Server Actions)
TypeScript (strict) · Tailwind CSS v4
Supabase: PostgreSQL + Auth + Storage, Row Level Security on every tenant table
```

---

## Table of contents

- [Feature overview](#feature-overview)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Database setup](#database-setup)
- [Available scripts](#available-scripts)
- [Project structure](#project-structure)
- [Security model](#security-model)
- [Deployment](#deployment)
- [Manual configuration still required](#manual-configuration-still-required)
- [Known limitations](#known-limitations)
- [Documentation](#documentation)

---

## Feature overview

| Module | What it does |
| --- | --- |
| **Authentication & organisations** | E-mail/password sign-up and sign-in, password reset, organisation onboarding, invitations, organisation switcher, three roles (administrator, manager, technician). |
| **Customers** | Individual or company records, multiple service addresses per customer, contact details, notes, tags, search and filters, detail page with intervention/quote/invoice history. |
| **Technicians** | Profiles with skills, availability status, colour coding for the planning board, hourly rate, optional link to a login, assigned interventions. |
| **Interventions** | Work orders with reference, customer + service address, assigned technician, schedule, status (draft, scheduled, in progress, completed, cancelled), priority, description, internal notes, before/after photos, lifecycle timestamps and history. |
| **Planning** | Day view grouped by technician (unassigned work first), week view, upcoming interventions, status indicators, technician load. |
| **Quotes** | Line items with quantity, unit, unit price, per-line VAT and discount, document-level discount, computed totals, VAT breakdown, statuses (draft, sent, accepted, rejected), printable/PDF-ready layout, conversion to invoice. |
| **Invoices** | Generated from an accepted quote, from a completed intervention, or manually; per-organisation numbering, VAT, totals, payment tracking (paid/partial/overdue), due dates, printable/PDF-ready layout. |
| **Dashboard** | Interventions today, upcoming work, pending quotes, unpaid and overdue invoices, revenue for the last six months, recent activity feed. |

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
cp .env.example .env.local      # then fill in the values (see below)

# 3. Apply the database migrations to your Supabase project
npx supabase link --project-ref <your-project-ref>
npx supabase db push            # or: supabase db reset (local, also seeds demo data)

# 4. Run the application
npm run dev                     # http://localhost:3000
```

Open <http://localhost:3000>, click **Start free** and create your organisation. The
first account becomes the administrator of the new workspace.

> No Supabase project yet? Create one for free at <https://supabase.com>, then copy the
> project URL and the publishable (anon) key from **Project settings → API**.

---

## Environment variables

All variables live in `.env.local` (never committed). `.env.example` documents them:

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Publishable/anon key. Safe in the browser: RLS is the security boundary. |
| `SUPABASE_SERVICE_ROLE_KEY` | no* | Server-only key that bypasses RLS. Only used by maintenance scripts (`/api/health`, scheduled jobs). Never exposed to the browser. |
| `NEXT_PUBLIC_APP_URL` | yes | Base URL used to build invitation and password-reset links (no trailing slash). |
| `NEXT_PUBLIC_APP_NAME` | no | Product name shown in the UI (defaults to `FieldFlow`). |

\* The application runs without the service-role key. It is required only if you enable
the optional maintenance scripts described in [docs/SETUP.md](docs/SETUP.md).

If the two public variables are missing, the app still starts and shows a setup screen
at `/setup` instead of crashing.

---

## Database setup

The schema, business rules and Row Level Security policies are versioned as SQL
migrations in [`supabase/migrations`](supabase/migrations) and must be applied before
using the app.

```bash
# Hosted project
npx supabase link --project-ref <your-project-ref>
npx supabase db push

# Local PostgreSQL via the Supabase CLI (Docker required)
npx supabase start          # starts Postgres, Auth, Storage…
npx supabase db reset       # applies migrations + supabase/seed.sql
```

`supabase/seed.sql` creates an optional demo organisation (customers, technicians,
interventions, quotes, invoices). It is idempotent and never touches real data. To attach
the demo workspace to your own login:

```sql
select public.seed_demo_data('you@example.com');
```

After applying the migrations you can verify the security posture at any time:

```sql
select * from public.rls_coverage();   -- every row must show rls_enabled = true
```

Full walkthrough: [docs/SETUP.md](docs/SETUP.md).

---

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server. |
| `npm run build` | Production build. |
| `npm start` | Serve the production build. |
| `npm run lint` | ESLint (flat config, Next.js + TypeScript rules). |
| `npm run typecheck` | `tsc --noEmit` in strict mode with `noUncheckedIndexedAccess`. |
| `npm run test` | Vitest unit tests for the pure business logic (money engine, validation, permissions, status machine, error mapping). |
| `npm run verify` | lint + typecheck + test + build in one go. |

---

## Project structure

```text
src/
  app/
    (auth)/              sign-in, sign-up, password reset, e-mail confirmation
    (app)/               authenticated application shell
      dashboard/         KPIs, revenue, activity, today's work
      customers/         list, create, detail (history), edit
      technicians/       list, create, detail, availability
      interventions/     list, create, detail (photos, history), edit
      planning/          day view, week view, upcoming
      quotes/            list, create, detail, edit, print/PDF
      invoices/          list, create, detail, edit, print/PDF
      settings/          organisation, team, profile
    auth/callback/       Supabase OAuth / e-mail link callback
    invite/[token]/      invitation redemption
    onboarding/          organisation creation for new accounts
    setup/               shown when the environment is not configured
  components/
    ui/                  design system (server-renderable primitives)
    layout/              app shell, navigation, org switcher, top bar
    dashboard/ customers/ technicians/ interventions/ planning/ documents/ quotes/ invoices/
  lib/
    actions/             Server Actions ('use server') per module
    auth/                session resolution and role guards
    db/                  server-only, org-scoped queries per module
    domain/              pure business logic: money engine, statuses, permissions
    supabase/            browser/server/admin clients + middleware session refresh
    utils/               formatting, class names, helpers
    validation/          Zod schemas for every user input
  types/database.ts      typed mirror of the PostgreSQL schema
supabase/
  migrations/            schema, triggers, business rules, RLS policies
  seed.sql               optional, idempotent demo dataset
docs/                    setup, architecture, security, database, conventions
tests/                   Vitest unit tests
```


---

## Security model

- **Row Level Security on every tenant table.** Policies call
  `public.is_org_member(organization_id)`, `public.can_manage_org_data(...)` and
  `public.is_org_admin(...)`; a forged organisation id cannot expose another tenant's rows.
- **Defence in depth.** The UI hides forbidden actions, the Server Action re-checks the
  role, and the RLS policy is the final gate. Every query is additionally filtered by
  `organization_id`.
- **No privileged credentials in the browser.** `SUPABASE_SERVICE_ROLE_KEY` is only read
  in `src/lib/supabase/admin.ts`, which imports `server-only` so the build fails if it is
  ever pulled into a client component.
- **All input validated** with Zod in the Server Actions; the database enforces the same
  rules again with `CHECK` constraints and cross-tenant guards
  (`assert_same_organization`, `assert_intervention_relations`, …).
- **Storage is private.** Before/after photos live in the `intervention-photos` bucket
  with policies keyed on the `{organization_id}/{intervention_id}/…` path prefix; the UI
  renders short-lived signed URLs.
- **Money and numbering are database-owned.** Totals come from triggers, document numbers
  from atomic per-organisation counters, so concurrent edits cannot corrupt them.

Details: [docs/SECURITY.md](docs/SECURITY.md).

---

## Deployment

1. Push the repository to your Git host and import it into Vercel (or any Node host).
2. Configure the environment variables from the table above (production values).
3. Apply the migrations to the production Supabase project: `npx supabase db push`.
4. In **Supabase → Authentication → URL configuration**, add your production domain to
   *Site URL* and *Redirect URLs* (`https://app.example.com/auth/callback`).
5. Deploy. The build needs no database connection: every data page is dynamic.

Recommended hardening for production: enable e-mail confirmation, set a strong password
policy in Supabase Auth, and schedule the optional maintenance jobs (overdue invoices,
expired invitations) with `pg_cron` — see [docs/SETUP.md](docs/SETUP.md).

---

## Manual configuration still required

Nothing in this repository contains real credentials. To run the project you must provide:

1. **A Supabase project** plus its URL and publishable key (`.env.local`).
2. **The migrations applied** (`npx supabase db push` or `supabase db reset`).
3. **E-mail delivery for auth e-mails** (confirmation, password reset): Supabase's built-in
   SMTP is rate-limited; configure your own provider in *Authentication → Emails*.
   In-app invitations deliberately do **not** depend on e-mail — the administrator
   receives a link to share.
4. **Site URL / Redirect URLs** in Supabase Auth so confirmation and reset links return to
   your deployment.
5. *(Optional)* `SUPABASE_SERVICE_ROLE_KEY` for the maintenance scripts.
6. *(Optional)* `pg_cron` schedules for `public.mark_overdue_invoices()` and
   `public.expire_stale_invitations()`.

---

## Known limitations

- **No e-mail sending for invitations.** The invite flow generates a shareable link the
  administrator sends manually; wiring `supabase.auth.admin.inviteUserByEmail` with the
  service-role key is a documented follow-up (the server-only admin client already exists).
- **PDF export uses the browser print dialog** ("Print / Save as PDF") on
  `/quotes/[id]/print` and `/invoices/[id]/print`. No server-side PDF renderer is bundled,
  to avoid a heavy dependency.
- **One workspace per user in the UI flow.** The data model supports multiple memberships
  and the sidebar has an organisation switcher, but the onboarding screen only creates the
  first workspace; additional ones are joined through invitations.
- **No recurring/contract interventions**, route optimisation or GPS tracking.
- **Revenue reporting** covers invoices by issue date; there is no full accounting ledger,
  credit notes or multi-currency conversion.
- **Timezone handling** stores `timestamptz` and renders in the server/browser locale. A
  per-organisation timezone column exists but is not applied to every rendering path yet.
- **Observability** is limited to structured server logs.

---

## Documentation

| Document | Content |
| --- | --- |
| [docs/SETUP.md](docs/SETUP.md) | Step-by-step local and hosted setup, seeding, optional jobs. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layering, data flow, key decisions and trade-offs. |
| [docs/DATABASE.md](docs/DATABASE.md) | Schema overview, relationships, triggers, numbering. |
| [docs/SECURITY.md](docs/SECURITY.md) | Tenant isolation, RLS policy matrix, threat model, checklist. |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | Coding conventions used across the codebase. |

