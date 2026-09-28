import Link from 'next/link';
import { CalendarDays, MoveHorizontal, UserX } from 'lucide-react';

import { WeekStrip } from '@/components/planning/date-navigator';
import { InterventionCard } from '@/components/planning/intervention-card';
import { PlanningFilters } from '@/components/planning/planning-filters';
import { PlanningLegend } from '@/components/planning/planning-legend';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { SegmentedLinks } from '@/components/ui/tabs';
import { requireOrganization } from '@/lib/auth/session';
import { listTechnicianOptions } from '@/lib/db/interventions';
import { getWeekSchedule, type PlanningEntry } from '@/lib/db/planning';
import { cn, buildQueryString } from '@/lib/utils/cn';
import { formatDate, toDateInputValue } from '@/lib/utils/format';

type SearchParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export default async function PlanningWeekPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireOrganization('/planning/week');
  const params = await searchParams;

  const start = single(params.start);
  const technicianId = single(params.technicianId);

  const [schedule, technicians] = await Promise.all([
    getWeekSchedule(session.organization.id, start),
    listTechnicianOptions(session.organization.id, { includeInactive: true }),
  ]);

  const matchesTechnician = (entry: PlanningEntry): boolean =>
    !technicianId || entry.intervention.technician_id === technicianId;

  const days = schedule.days.map((day) => ({
    ...day,
    entries: day.entries.filter(matchesTechnician),
  }));
  const unassigned = technicianId ? [] : schedule.unassigned;
  const weekTotal = days.reduce((total, day) => total + day.entries.length, 0);
  const today = toDateInputValue(new Date());

  const viewItems = [
    { label: 'Day', href: `/planning${buildQueryString({ date: schedule.start })}`, active: false },
    {
      label: 'Week',
      href: `/planning/week${buildQueryString({ start: schedule.start })}`,
      active: true,
    },
    { label: 'Upcoming', href: '/planning/upcoming', active: false },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Week planning"
        description="Monday to Sunday. Scroll sideways on a small screen to reach the weekend."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Planning', href: '/planning' },
          { label: 'Week' },
        ]}
      />

      <SegmentedLinks items={viewItems} />

      <Card className="space-y-4 p-4">
        <WeekStrip
          start={schedule.start}
          basePath="/planning/week"
          params={{ technicianId: technicianId || undefined }}
        />
        <PlanningFilters
          action="/planning/week"
          technicians={technicians}
          values={{ technicianId }}
          hidden={{ start: schedule.start }}
        />
      </Card>

      {unassigned.length > 0 ? (
        <section
          aria-label={`To plan: ${unassigned.length}`}
          className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3"
        >
          <header className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <UserX aria-hidden className="size-4" />
              To plan
            </span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 tabular-nums">
              {unassigned.length} waiting
            </span>
          </header>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {unassigned.map((entry) => (
              <li key={entry.intervention.id}>
                <InterventionCard entry={entry} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {weekTotal === 0 ? (
        <EmptyState
          icon={<CalendarDays aria-hidden className="size-5" />}
          title="Nothing planned this week"
          description={
            unassigned.length > 0
              ? 'Draft work is waiting in the “To plan” bucket above — give it a date and a technician.'
              : 'Navigate to another week or create a new intervention.'
          }
          action={
            <Link
              href={`/planning/week${buildQueryString({ start: schedule.start, technicianId: technicianId || undefined })}`}
              className="text-sm font-medium text-indigo-700 hover:underline"
            >
              Reload this week
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs text-slate-500 lg:hidden">
            <MoveHorizontal aria-hidden className="size-3.5" />
            Swipe horizontally to see the whole week.
          </p>

          <div className="table-scroll w-full">
            <div className="grid min-w-[64rem] grid-cols-7 gap-3">
              {days.map((day) => (
                <section key={day.date} aria-label={formatDate(day.date, 'EEEE dd/MM/yyyy')} className="space-y-2">
                  <header
                    className={cn(
                      'rounded-lg border px-2.5 py-2',
                      day.date === today
                        ? 'border-indigo-300 bg-indigo-50'
                        : 'border-slate-200 bg-white',
                    )}
                  >
                    <p className="text-xs font-semibold text-slate-900">
                      {formatDate(day.date, 'EEE dd/MM')}
                    </p>
                    <p className="text-[11px] text-slate-500 tabular-nums">
                      {day.entries.length} job{day.entries.length === 1 ? '' : 's'}
                      {day.date === today ? ' · Today' : ''}
                    </p>
                  </header>

                  {day.entries.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-300 px-2 py-3 text-center text-[11px] text-slate-500">
                      Free
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {day.entries.map((entry) => (
                        <li key={entry.intervention.id}>
                          <InterventionCard entry={entry} showTechnician />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          </div>
        </div>
      )}

      <PlanningLegend />
    </PageContainer>
  );
}
