import Link from 'next/link';
import { CalendarDays, FileText, Users, Wrench } from 'lucide-react';

import { buttonClasses } from '@/components/ui/button';
import { APP_NAME } from '@/lib/env';

const FEATURES = [
  {
    icon: <CalendarDays aria-hidden className="size-5" />,
    title: 'Plan the week',
    body: 'Day and week views per technician, with unassigned work kept visible so nothing slips.',
  },
  {
    icon: <Wrench aria-hidden className="size-5" />,
    title: 'Run interventions',
    body: 'Work orders with status, priority, schedule, before/after photos and a full history.',
  },
  {
    icon: <Users aria-hidden className="size-5" />,
    title: 'Know your customers',
    body: 'Individuals or companies, multiple service sites, notes and complete intervention history.',
  },
  {
    icon: <FileText aria-hidden size={20} />,
    title: 'Get paid',
    body: 'Quotes with VAT and discounts, one-click conversion into numbered, print-ready invoices.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            {APP_NAME.slice(0, 1)}
          </span>
          <span className="text-base font-semibold text-slate-900">{APP_NAME}</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link href="/sign-in" className={buttonClasses('ghost', 'sm')}>
            Sign in
          </Link>
          <Link href="/sign-up" className={buttonClasses('primary', 'sm')}>
            Start free
          </Link>
        </nav>
      </header>

      <main id="main">
        <section className="mx-auto w-full max-w-6xl px-4 pt-10 pb-16 sm:px-6 sm:pt-16">
          <div className="max-w-3xl">
            <p className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200 ring-inset">
              Built for small service businesses
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 text-balance-pretty sm:text-5xl">
              Field service management for plumbers, electricians, HVAC and maintenance teams
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
              Schedule interventions, dispatch your technicians, keep customer history in one place
              and turn completed work into invoices — without enterprise software overhead.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/sign-up" className={buttonClasses('primary', 'lg')}>
                Create your organisation
              </Link>
              <Link href="/sign-in" className={buttonClasses('outline', 'lg')}>
                Sign in to an existing account
              </Link>
            </div>
          </div>

          <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <li
                key={feature.title}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  {feature.icon}
                </span>
                <h2 className="mt-3 text-sm font-semibold text-slate-900">{feature.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{feature.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-y border-slate-200 bg-slate-50">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                One workspace per organisation
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Every customer, intervention, quote and invoice belongs to your organisation only.
                Tenant isolation is enforced in the database itself with PostgreSQL Row Level
                Security, not just in the user interface.
              </p>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Roles that fit real teams</h2>
              <p className="mt-2 text-sm text-slate-600">
                Administrators manage the company and the team, managers handle customers and
                planning, technicians see their day and update their own jobs.
              </p>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Ready for the back office</h2>
              <p className="mt-2 text-sm text-slate-600">
                VAT handling per line, document numbering per organisation, payment tracking and
                print-ready PDF layouts for quotes and invoices.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-8 text-xs text-slate-500 sm:px-6">
        <p>
          {APP_NAME} — field service management. Open the{' '}
          <Link href="/setup" className="underline hover:text-slate-700">
            setup guide
          </Link>{' '}
          after cloning the repository.
        </p>
      </footer>
    </div>
  );
}
