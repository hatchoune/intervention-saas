import Link from 'next/link';
import { CalendarDays, CalendarRange, Clock, UserX } from 'lucide-react';

import { InterventionCard } from '@/components/planning/intervention-card';
import { DayStrip } from '@/components/planning/date-navigator';
import { PlanningFilters } from '@/components/planning/planning-filters';
import { PlanningLegend } from '@/components/planning/planning-legend';
import { TechnicianLane } from '@/components/planning/technician-lane';
import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/ui/data-display';
import { EmptyState } from '@/components/ui/empty-state';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { SegmentedLinks } from '@/components/ui/tabs';
import { requireOrganization } from '@/lib/auth/session';
import { listTechnicianOptions } from '@/lib/db/interventions';
import { getDaySchedule } from '@/lib/db/planning';
import { buildQueryString } from '@/lib/utils/cn';

type SearchParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export default async function PlanningDayPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireOrganization('/planning');
  const params = await searchParams;

  const date = single(params.date);
  const technicianId = single(params.technicianId);

  const [schedule, technicians] = await Promise.all([
    getDaySchedule(session.organization.id, date),
    listTechnicianOptions(session.organization.id, { includeInactive: true }),
  ]);

  const lanes = technicianId
    ? schedule.lanes.filter((lane) => lane.technician.id === technicianId)
    : schedule.lanes;
  const unassigned = technicianId ? [] : schedule.unassigned;
  const plannedTotal = lanes.reduce((total, lane) => total + lane.entries.length, 0);

  const viewItems = [
    { label: 'Day', href: `/planning${buildQueryString({ date: schedule.date })}`, active: true },
    { label: 'Week', href: `/planning/week${buildQueryString({ start: schedule.date })}`, active: false },
    { label: 'Upcoming', href: '/planning/upcoming', active: false },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Planning"
        description="Who is where today. Unassigned work is listed first so nothing slips through."
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Planning' }]}
        actions={
          <Link href="/interventions/new" className={buttonClasses('primary', 'md')}>
            <CalendarDays aria-hidden className="size-4" />
            New intervention
          </Link>
        }
      />

      <SegmentedLinks items={viewItems} />

      <Card className="space-y-4 p-4">
        <DayStrip date={schedule.date} basePath="/planning" params={{ technicianId: technicianId || undefined }} />
        <PlanningFilters
          action="/planning"
          technicians={technicians}
          values={{ technicianId }}
          hidden={{ date: schedule.date }}
        />
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Jobs today"
          value={plannedTotal + unassigned.length}
          icon={<CalendarRange aria-hidden className="size-4" />}
        />
        <StatCard
          label="Unassigned"
          value={unassigned.length}
          tone={unassigned.length > 0 ? 'warning' : 'default'}
          icon={<UserX aria-hidden className="size-4" />}
        />
        <StatCard
          label="Technicians with work"
          value={lanes.filter((lane) => lane.entries.length > 0).length}
          hint={`${lanes.length} active in the team`}
          icon={<Clock aria-hidden className="size-4" />}
        />
      </div>

      {plannedTotal + unassigned.length === 0 ? (
        <EmptyState
          icon={<CalendarDays aria-hidden className="size-5" />}
          title="Nothing planned for this day"
          description="Pick another day, or look at the week to spot free slots."
          action={
            <Link
              href={`/planning/week${buildQueryString({ start: schedule.date })}`}
              className={buttonClasses('outline', 'md')}
            >
              <CalendarRange aria-hidden className="size-4" />
              Open the week view
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {unassigned.length > 0 ? (
            <section
              aria-label={`Unassigned: ${unassigned.length}`}
              className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3"
            >
              <header className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                  <UserX aria-hidden className="size-4" />
                  Unassigned
                </span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 tabular-nums">
                  {unassigned.length} to assign
                </span>
              </header>
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {unassigned.map((entry) => (
                  <li key={entry.intervention.id}>
                    <InterventionCard entry={entry} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {lanes.length === 0 ? (
            <EmptyState
              title="No technician matches this filter"
              description="Clear the technician filter to see the whole team."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {lanes.map((lane) => (
                <TechnicianLane key={lane.technician.id} lane={lane} />
              ))}
            </div>
          )}
        </div>
      )}

      <PlanningLegend />
    </PageContainer>
  );
}
