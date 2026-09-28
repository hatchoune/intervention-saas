import Link from 'next/link';
import { CalendarClock, CalendarDays } from 'lucide-react';

import { InterventionCard } from '@/components/planning/intervention-card';
import { PlanningFilters } from '@/components/planning/planning-filters';
import { PlanningLegend } from '@/components/planning/planning-legend';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/ui/data-display';
import { EmptyState } from '@/components/ui/empty-state';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { SegmentedLinks } from '@/components/ui/tabs';
import { requireOrganization } from '@/lib/auth/session';
import { listTechnicianOptions } from '@/lib/db/interventions';
import { getUpcoming, resolveWindowDays } from '@/lib/db/planning';
import { buildQueryString } from '@/lib/utils/cn';
import { formatDate, formatRelative } from '@/lib/utils/format';
import type { InterventionStatus } from '@/types/database';

type SearchParams = Record<string, string | string[] | undefined>;

const STATUS_VALUES: InterventionStatus[] = ['draft', 'scheduled', 'in_progress', 'completed'];

function single(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export default async function PlanningUpcomingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireOrganization('/planning/upcoming');
  const params = await searchParams;

  const technicianId = single(params.technicianId);
  const status = STATUS_VALUES.find((value) => value === single(params.status)) ?? null;
  const days = resolveWindowDays(single(params.days), 30);

  const [upcoming, technicians] = await Promise.all([
    getUpcoming(session.organization.id, {
      days,
      technicianId: technicianId || null,
      status,
    }),
    listTechnicianOptions(session.organization.id, { includeInactive: true }),
  ]);

  const viewItems = [
    { label: 'Day', href: `/planning${buildQueryString({ date: upcoming.from })}`, active: false },
    { label: 'Week', href: `/planning/week${buildQueryString({ start: upcoming.from })}`, active: false },
    { label: 'Upcoming', href: '/planning/upcoming', active: true },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Upcoming work"
        description={`Scheduled interventions from ${formatDate(upcoming.from)} to ${formatDate(upcoming.to)}.`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Planning', href: '/planning' },
          { label: 'Upcoming' },
        ]}
      />

      <SegmentedLinks items={viewItems} />

      <Card className="space-y-4 p-4">
        <PlanningFilters
          action="/planning/upcoming"
          technicians={technicians}
          values={{ technicianId, status: status ?? '', days: String(days) }}
          includeStatus
          includeDays
        />
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Jobs in the window"
          value={upcoming.total}
          icon={<CalendarClock aria-hidden className="size-4" />}
        />
        <StatCard label="Days with work" value={upcoming.groups.length} />
        <StatCard label="Horizon" value={`${upcoming.days} days`} hint="From today" />
      </div>

      {upcoming.groups.length === 0 ? (
        <EmptyState
          icon={<CalendarDays aria-hidden className="size-5" />}
          title="No upcoming intervention"
          description="Widen the horizon or clear a filter to see more work."
          action={
            <Link href="/interventions/new" className="text-sm font-medium text-indigo-700 hover:underline">
              Create an intervention
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          {upcoming.groups.map((group) => (
            <section key={group.date} aria-label={formatDate(group.date, 'EEEE dd/MM/yyyy')} className="space-y-3">
              <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
                <h2 className="text-sm font-semibold text-slate-900">
                  {formatDate(group.date, 'EEEE dd/MM/yyyy')}
                </h2>
                <span className="text-xs text-slate-500">{formatRelative(`${group.date}T12:00:00`)}</span>
                <Badge tone="neutral" className="ml-auto tabular-nums">
                  {group.entries.length} job{group.entries.length === 1 ? '' : 's'}
                </Badge>
              </header>

              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {group.entries.map((entry) => (
                  <li key={entry.intervention.id}>
                    <InterventionCard entry={entry} showTechnician />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <PlanningLegend />
    </PageContainer>
  );
}
