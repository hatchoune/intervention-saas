import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';

import {
  BillingPanels,
  ActivityFeed,
  InterventionCompactList,
} from '@/components/dashboard/dashboard-lists';
import { DashboardMetrics, RevenuePanel } from '@/components/dashboard/dashboard-metrics';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { requireOrganization } from '@/lib/auth/session';
import { getDashboardData } from '@/lib/db/dashboard';
import { can } from '@/lib/domain/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatDayLabel } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

/**
 * Technician home: their assumed technician id is resolved from the link
 * between a membership and a technician record, so the dashboard shows
 * "my day" instead of the whole company's backlog.
 */
async function resolveTechnicianId(
  organizationId: string,
  userId: string,
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('technicians')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle();

  return data?.id ?? null;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await requireOrganization();
  const { organization, role, user } = session;

  const technicianId = role === 'technician' ? await resolveTechnicianId(organization.id, user.id) : null;

  const data = await getDashboardData({
    organizationId: organization.id,
    restrictToTechnicianId: technicianId,
    listLimit: 5,
  });

  const firstName = (session.profile?.full_name ?? user.email ?? '').split(/[\s@]/)[0] ?? 'there';
  const welcome = params.welcome ? 'Your workspace is ready. ' : '';
  const invitationAccepted = params.invitationAccepted ? 'You joined the organisation. ' : '';

  return (
    <PageContainer>
      <PageHeader
        title={`Hello ${firstName}`}
        description={`${formatDayLabel(new Date())} — here is what matters right now.`}
        actions={
          can('interventions.manage', role) ? (
            <>
              <Link href="/interventions/new" className={buttonClasses('primary', 'md')}>
                <Plus aria-hidden className="size-4" />
                New intervention
              </Link>
              <Link href="/customers/new" className={buttonClasses('outline', 'md')}>
                New customer
              </Link>
            </>
          ) : null
        }
      />

      {welcome || invitationAccepted ? (
        <Alert variant="success" title="Welcome aboard">
          {welcome}
          {invitationAccepted}
          {can('team.manage', role) ? (
            <>
              {' '}
              <Link href="/settings/team" className="font-medium underline">
                Invite your colleagues
              </Link>{' '}
              to work with you.
            </>
          ) : (
            ' Your administrator can fine-tune roles from the team settings.'
          )}
        </Alert>
      ) : null}

      {params.error === 'forbidden' ? (
        <Alert variant="warning" title="Restricted area">
          Your role does not allow access to that page. Ask an administrator if you need it.
        </Alert>
      ) : null}

      <DashboardMetrics data={data} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Today&apos;s interventions</CardTitle>
            <Link href="/planning" className="text-xs font-medium text-indigo-600">
              Open planning
            </Link>
          </CardHeader>
          <CardContent>
            <InterventionCompactList data={data} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityFeed data={data} />
          </CardContent>
        </Card>
      </div>

      <BillingPanels data={data} />

      <RevenuePanel data={data} />
    </PageContainer>
  );
}
