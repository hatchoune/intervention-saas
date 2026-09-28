import type { Metadata } from 'next';

import { ProfileForm } from '@/app/(app)/settings/profile/profile-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MetaItem, MetaList } from '@/components/ui/table';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { requireOrganization } from '@/lib/auth/session';
import { ORGANIZATION_ROLE_META } from '@/lib/domain/status';

export const metadata: Metadata = { title: 'My profile' };

export default async function ProfileSettingsPage() {
  const session = await requireOrganization('/settings/profile');
  const { profile, user, organization, role } = session;

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        title="My profile"
        description="How your name appears to colleagues on interventions and in the activity feed."
        breadcrumbs={[{ label: 'Settings' }, { label: 'My profile' }]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={profile} email={user.email ?? ''} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Membership</CardTitle>
          <CardDescription>Managed by your organisation administrators.</CardDescription>
        </CardHeader>
        <CardContent>
          <MetaList>
            <MetaItem label="Organisation">{organization.name}</MetaItem>
            <MetaItem label="Role">{ORGANIZATION_ROLE_META[role].label}</MetaItem>
            <MetaItem label="Role scope" className="sm:col-span-2">
              {ORGANIZATION_ROLE_META[role].description}
            </MetaItem>
          </MetaList>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
