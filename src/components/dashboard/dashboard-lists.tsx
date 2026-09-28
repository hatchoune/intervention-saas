import Link from 'next/link';
import { CalendarDays } from 'lucide-react';

import { Badge, StatusDot } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { INTERVENTION_STATUS_META, INVOICE_STATUS_META } from '@/lib/domain/status';
import type { DashboardData } from '@/lib/db/dashboard';
import { formatCurrency, formatDate, formatDateTime, formatTime } from '@/lib/utils/format';

/** Today's interventions, compact list. */
export function InterventionCompactList({ data }: { data: DashboardData }) {
  if (data.today.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays aria-hidden className="size-5" />}
        title="Nothing scheduled today"
        description="Enjoy the calm — or plan the next visit."
        action={
          <Link href="/planning" className="text-sm font-medium text-indigo-600">
            Open the planning board
          </Link>
        }
      />
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {data.today.map(({ intervention, customerName, technicianName }) => {
        const status = INTERVENTION_STATUS_META[intervention.status];

        return (
          <li key={intervention.id} className="flex items-start gap-3 py-3">
            <span className="w-14 shrink-0 pt-0.5 text-xs font-medium tabular-nums text-slate-500">
              {intervention.scheduled_start ? formatTime(intervention.scheduled_start) : '—'}
            </span>
            <div className="min-w-0 flex-1">
              <Link
                href={`/interventions/${intervention.id}`}
                className="text-sm font-medium text-slate-800 hover:text-indigo-600"
              >
                {intervention.title}
              </Link>
              <p className="truncate text-xs text-slate-500">
                {customerName}
                {intervention.city ? ` · ${intervention.city}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Badge tone={status.tone}>
                <StatusDot tone={status.tone} />
                {status.label}
              </Badge>
              {technicianName ? (
                <span className="text-xs text-slate-500">{technicianName}</span>
              ) : (
                <span className="text-xs font-medium text-amber-600">Unassigned</span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Pending quotes and unpaid invoices side by side. */
export function BillingPanels({ data }: { data: DashboardData }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Pending quotes</CardTitle>
          <Link href="/quotes" className="text-xs font-medium text-indigo-600">
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {data.pendingQuotes.length === 0 ? (
            <p className="text-sm text-slate-500">No quote awaiting an answer.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.pendingQuotes.map(({ quote, customerName }) => (
                <li key={quote.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link
                      href={`/quotes/${quote.id}`}
                      className="text-sm font-medium text-slate-800 hover:text-indigo-600"
                    >
                      {quote.quote_number}
                    </Link>
                    <p className="truncate text-xs text-slate-500">
                      {customerName} · {formatDate(quote.issue_date)}
                    </p>
                  </div>
                  <span className="text-sm font-medium tabular-nums text-slate-700">
                    {formatCurrency(quote.total, quote.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Unpaid invoices</CardTitle>
          <Link href="/invoices" className="text-xs font-medium text-indigo-600">
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {data.unpaidInvoices.length === 0 ? (
            <p className="text-sm text-slate-500">Everything is paid. Nice.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.unpaidInvoices.map(({ invoice, customerName, effectiveStatus, balance }) => {
                const status = INVOICE_STATUS_META[effectiveStatus];

                return (
                  <li key={invoice.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="text-sm font-medium text-slate-800 hover:text-indigo-600"
                      >
                        {invoice.invoice_number}
                      </Link>
                      <p className="truncate text-xs text-slate-500">
                        {customerName} · due {formatDate(invoice.due_date)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-medium tabular-nums text-slate-700">
                        {formatCurrency(balance, invoice.currency)}
                      </span>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Append-only activity trail. */
export function ActivityFeed({ data }: { data: DashboardData }) {
  if (data.recentActivity.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Activity will appear here as your team creates customers, plans interventions and issues
        documents.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {data.recentActivity.map((entry) => (
        <li key={entry.id} className="flex gap-3">
          <span aria-hidden className="mt-1.5">
            <StatusDot tone={entry.action === 'deleted' ? 'danger' : 'accent'} />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-slate-700">{entry.summary}</p>
            <p className="text-xs text-slate-400">
              {entry.actor_name ?? 'System'} · {formatDateTime(entry.created_at)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

