import {
  CalendarClock,
  CalendarDays,
  ClipboardList,
  FileText,
  Receipt,
  Users,
  Wrench,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/data-display';
import { EmptyState } from '@/components/ui/empty-state';
import type { DashboardData } from '@/lib/db/dashboard';
import { formatCurrency, formatDate } from '@/lib/utils/format';

/** KPI grid for the dashboard. */
export function DashboardMetrics({ data }: { data: DashboardData }) {
  const { summary } = data;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Interventions today"
        value={summary.interventions_today}
        hint={`${summary.interventions_in_progress} in progress · ${summary.interventions_unassigned} unassigned`}
        icon={<CalendarDays aria-hidden className="size-4" />}
        href="/planning"
      />
      <StatCard
        label="Upcoming"
        value={summary.interventions_upcoming}
        hint="Scheduled after today"
        icon={<CalendarClock aria-hidden className="size-4" />}
        href="/planning/upcoming"
      />
      <StatCard
        label="Pending quotes"
        value={summary.pending_quotes}
        hint={formatCurrency(summary.pending_quotes_amount)}
        icon={<FileText aria-hidden className="size-4" />}
        tone="accent"
        href="/quotes"
      />
      <StatCard
        label="Unpaid invoices"
        value={summary.unpaid_invoices}
        hint={`${formatCurrency(summary.unpaid_invoices_amount)} outstanding${
          summary.overdue_invoices > 0 ? ` · ${summary.overdue_invoices} overdue` : ''
        }`}
        icon={<Receipt aria-hidden className="size-4" />}
        tone={summary.overdue_invoices > 0 ? 'danger' : 'default'}
        href="/invoices"
      />
      <StatCard
        label="Revenue this month"
        value={formatCurrency(summary.revenue_this_month)}
        hint={`Last 30 days: ${formatCurrency(summary.revenue_last_30_days)}`}
        tone="success"
        icon={<Wrench aria-hidden className="size-4" />}
      />
      <StatCard
        label="Last month"
        value={formatCurrency(summary.revenue_last_month)}
        hint="Invoiced total"
      />
      <StatCard
        label="Completed, to invoice"
        value={summary.interventions_to_invoice}
        hint="Finished jobs with no invoice yet"
        icon={<ClipboardList aria-hidden className="size-4" />}
        tone={summary.interventions_to_invoice > 0 ? 'warning' : 'default'}
      />
      <StatCard
        label="Active customers"
        value={summary.active_customers}
        hint={`${summary.active_technicians} technicians available`}
        icon={<Users aria-hidden className="size-4" />}
        href="/customers"
      />
    </div>
  );
}

/** Simple CSS bar chart: no charting dependency needed for six months. */
export function RevenuePanel({ data }: { data: DashboardData }) {
  const max = Math.max(1, ...data.revenue.map((entry) => Number(entry.invoiced)));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue (last 6 months)</CardTitle>
        <p className="text-xs text-slate-500">Invoiced vs collected</p>
      </CardHeader>
      <CardContent>
        {data.revenue.length === 0 ? (
          <EmptyState
            title="No invoiced revenue yet"
            description="Invoices you issue will be summarised here."
          />
        ) : (
          <>
            <ul className="space-y-2.5">
              {data.revenue.map((entry) => {
                const invoiced = Number(entry.invoiced);
                const paid = Number(entry.paid);
                const width = Math.max(2, Math.round((invoiced / max) * 100));

                return (
                  <li key={entry.month_start}>
                    <div className="flex items-baseline justify-between gap-2 text-xs text-slate-600">
                      <span className="font-medium">
                        {formatDate(entry.month_start, 'MMM yyyy')}
                      </span>
                      <span className="tabular-nums">
                        {formatCurrency(invoiced)}
                        <span className="text-slate-400"> · paid {formatCurrency(paid)}</span>
                      </span>
                    </div>
                    <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        aria-hidden
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-xs text-slate-500">
              Revenue is counted on the invoice issue date, excluding cancelled invoices.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
