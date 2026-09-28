import Link from 'next/link';

import { Card, CardContent } from '@/components/ui/card';
import { APP_NAME } from '@/lib/env';

/**
 * Split layout for the authentication routes: the form on the left, a product
 * reminder on the right (hidden on small screens where space is precious).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col justify-center px-4 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto w-full max-w-md space-y-6">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
              {APP_NAME.slice(0, 1)}
            </span>
            <span className="text-base font-semibold text-slate-900">{APP_NAME}</span>
          </Link>

          {children}
        </div>
      </div>

      <aside className="hidden bg-slate-900 px-12 py-16 text-slate-100 lg:flex lg:flex-col lg:justify-center">
        <div className="max-w-md space-y-6">
          <h2 className="text-2xl font-semibold tracking-tight">
            Everything your field team needs, in one place
          </h2>
          <ul className="space-y-4 text-sm text-slate-300">
            <li>
              <span className="font-medium text-white">Planning that stays honest.</span> Day and
              week views per technician, with unassigned work front and centre.
            </li>
            <li>
              <span className="font-medium text-white">Customer history that survives turnover.</span>{' '}
              Every visit, quote and invoice attached to the right site.
            </li>
            <li>
              <span className="font-medium text-white">Money handled properly.</span> VAT per line,
              per-organisation numbering, payment tracking and printable documents.
            </li>
          </ul>
          <Card className="border-slate-700 bg-slate-800/60">
            <CardContent className="text-xs text-slate-300">
              Tenant data is isolated at the database level with Row Level Security: no organisation
              can ever read another one&apos;s records.
            </CardContent>
          </Card>
        </div>
      </aside>
    </div>
  );
}
