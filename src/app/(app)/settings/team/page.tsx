import type { Metadata } from 'next';

import { InviteMemberForm } from '@/app/(app)/settings/team/invite-member-form';
import {
  MemberRoleForm,
  RemoveMemberAction,
  RevokeInvitationAction,
} from '@/app/(app)/settings/team/team-actions';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/data-display';
import { EmptyState } from '@/components/ui/empty-state';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableWrapper,
} from '@/components/ui/table';
import { requireCapability } from '@/lib/auth/session';
import { ORGANIZATION_ROLE_META } from '@/lib/domain/status';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatDate, formatRelative } from '@/lib/utils/format';
import type {
  MembershipRow,
  OrganizationInvitationRow,
  OrganizationRole,
  ProfileRow,
} from '@/types/database';

export const metadata: Metadata = { title: 'Team' };

const ROLE_HINT: Record<OrganizationRole, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  technician: 'Technician',
};

export default async function TeamSettingsPage() {
  const session = await requireCapability('team.manage', '/settings/team');
  const supabase = await createSupabaseServerClient();

  const [membershipsResult, invitationsResult] = await Promise.all([
    supabase
      .from('memberships')
      .select('*')
      .eq('organization_id', session.organization.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('organization_invitations')
      .select('*')
      .eq('organization_id', session.organization.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
  ]);

  const memberships = (membershipsResult.data ?? []) as MembershipRow[];
  const invitations = (invitationsResult.data ?? []) as OrganizationInvitationRow[];

  const userIds = memberships.map((membership) => membership.user_id);
  const profilesResult =
    userIds.length > 0
      ? await supabase.from('profiles').select('*').in('id', userIds)
      : { data: [] as ProfileRow[] };

  const profiles = new Map(
    ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
  );

  return (
    <PageContainer className="max-w-5xl">
      <PageHeader
        title="Team"
        description="Who can access this workspace, and with which role."
        breadcrumbs={[{ label: 'Settings' }, { label: 'Team' }]}
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Invite a colleague</CardTitle>
            <CardDescription>
              Generates a single-use link tied to their e-mail address and role.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <InviteMemberForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members ({memberships.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <TableWrapper>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Member</TableHeaderCell>
                  <TableHeaderCell>Role</TableHeaderCell>
                  <TableHeaderCell className="hidden sm:table-cell">Joined</TableHeaderCell>
                  <TableHeaderCell className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {memberships.map((membership) => {
                  const profile = profiles.get(membership.user_id);
                  const displayName = profile?.full_name ?? 'Member';
                  const isSelf = membership.user_id === session.user.id;

                  return (
                    <TableRow key={membership.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar name={displayName} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800">
                              {displayName}
                              {isSelf ? <span className="text-slate-400"> (you)</span> : null}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {profile?.job_title ?? ROLE_HINT[membership.role]}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <MemberRoleForm membershipId={membership.id} role={membership.role} />
                      </TableCell>
                      <TableCell className="hidden text-xs text-slate-500 sm:table-cell">
                        {formatDate(membership.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        {isSelf ? null : (
                          <RemoveMemberAction
                            membershipId={membership.id}
                            memberName={displayName}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableWrapper>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending invitations ({invitations.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <EmptyState
              title="No pending invitation"
              description="Invite a colleague above to share this workspace."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {invitations.map((invitation) => (
                <li
                  key={invitation.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {invitation.email}
                    </p>
                    <p className="text-xs text-slate-500">
                      Expires {formatRelative(invitation.expires_at)} · invited{' '}
                      {formatDate(invitation.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={ORGANIZATION_ROLE_META[invitation.role].tone}>
                      {ORGANIZATION_ROLE_META[invitation.role].label}
                    </Badge>
                    <RevokeInvitationAction invitationId={invitation.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
