import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarClock, CheckCircle2, Pencil, Phone, Wrench } from 'lucide-react';

import { InterventionCompactList } from '@/components/interventions/intervention-compact-list';
import {
  DeleteTechnicianAction,
  TechnicianStatusControl,
} from '@/components/technicians/technician-status-control';
import { Badge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, StatCard } from '@/components/ui/data-display';
import { EmptyState } from '@/components/ui/empty-state';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { MetaItem, MetaList } from '@/components/ui/table';
import { requireOrganization } from '@/lib/auth/session';
import { getTechnicianDetail } from '@/lib/db/technicians';
import { can } from '@/lib/domain/permissions';
import { TECHNICIAN_STATUS_META } from '@/lib/domain/status';
import { formatCurrency, formatDate } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Technician' };

export default async function TechnicianDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireOrganization(`/technicians/${id}`);

  const detail = await getTechnicianDetail(session.organization.id, id);
  if (!detail) notFound();

  const { technician, load, upcoming, recent } = detail;
  const canManage = can('technicians.manage', session.role);
  const isSelf = technician.user_id === session.user.id;

  return (
    <PageContainer>
      <Link
        href="/technicians"
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft aria-hidden className="size-4" />
        All technicians
      </Link>

      <PageHeader
        title={technician.full_name}
        description={technician.job_title ?? TECHNICIAN_STATUS_META[technician.status].description}
        actions={
          <>
            {isSelf || canManage ? (
              <TechnicianStatusControl
                technicianId={technician.id}
                status={technician.status}
                className="mr-1"
              />
            ) : null}
            {canManage ? (
              <>
                <Link
                  href={`/technicians/${technician.id}/edit`}
                  className={buttonClasses('outline', 'md')}
                >
                  <Pencil aria-hidden className="size-4" />
                  Edit
                </Link>
                <DeleteTechnicianAction
                  technicianId={technician.id}
                  technicianName={technician.full_name}
                />
              </>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Open work"
          value={load.open}
          hint="Draft, scheduled and in progress"
          icon={<Wrench aria-hidden className="size-4" />}
        />
        <StatCard
          label="Today"
          value={load.today}
          tone="accent"
          icon={<CalendarClock aria-hidden className="size-4" />}
        />
        <StatCard
          label="Upcoming"
          value={load.upcoming}
          hint="Scheduled today or later"
          tone="default"
        />
        <StatCard
          label="Completed"
          value={load.completed}
          tone="success"
          icon={<CheckCircle2 aria-hidden className="size-4" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle as="h2">Upcoming interventions</CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <EmptyState
                  title="Nothing scheduled"
                  description="Assign work from the planning board or from an intervention page."
                />
              ) : (
                <InterventionCompactList rows={upcoming} emptyLabel="Nothing scheduled." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">Recently created</CardTitle>
            </CardHeader>
            <CardContent>
              <InterventionCompactList rows={recent} emptyLabel="No intervention assigned yet." />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle as="h2">Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar name={technician.full_name} color={technician.color} size="lg" />
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-slate-900">{technician.full_name}</p>
                  <Badge tone={TECHNICIAN_STATUS_META[technician.status].tone}>
                    {TECHNICIAN_STATUS_META[technician.status].label}
                  </Badge>
                </div>
              </div>

              <MetaList className="sm:grid-cols-1">
                <MetaItem label="E-mail">{technician.email ?? '—'}</MetaItem>
                <MetaItem label="Phone">
                  {technician.phone ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone aria-hidden className="size-3.5 text-slate-400" />
                      {technician.phone}
                    </span>
                  ) : (
                    '—'
                  )}
                </MetaItem>
                <MetaItem label="Hourly rate">
                  {technician.hourly_rate === null ? '—' : `${formatCurrency(technician.hourly_rate)}/h`}
                </MetaItem>
                <MetaItem label="Login">
                  {technician.user_id ? 'Linked to an account' : 'Not linked'}
                </MetaItem>
                <MetaItem label="Team member since">{formatDate(technician.created_at)}</MetaItem>
              </MetaList>

              {technician.skills.length > 0 ? (
                <div className="border-t border-slate-200 pt-3">
                  <h3 className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                    Skills
                  </h3>
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {technician.skills.map((skill) => (
                      <Badge key={skill} tone="neutral">
                        {skill}
                      </Badge>
                    ))}
                  </span>
                </div>
              ) : null}

              {technician.notes ? (
                <div className="border-t border-slate-200 pt-3">
                  <h3 className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                    Internal notes
                  </h3>
                  <p className="mt-1 text-sm whitespace-pre-line text-slate-700">
                    {technician.notes}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

      </div>

    </PageContainer>
  );
}
