import type { Metadata } from 'next';
import Link from 'next/link';

import { OrganizationProfileForm } from '@/app/(app)/settings/organization/organization-profile-form';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { requireCapability } from '@/lib/auth/session';
import { formatDate } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Organisation settings' };

export default async function OrganizationSettingsPage() {
  const session = await requireCapability('organization.edit', '/settings/organization');
  const { organization } = session;

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        title="Organisation settings"
        description="Company identity used on quotes, invoices and e-mails, plus your billing defaults."
        breadcrumbs={[{ label: 'Settings' }, { label: 'Organisation' }]}
        actions={
          <ButtonLink href="/settings/team" variant="outline">
            Manage the team
          </ButtonLink>
        }
      />

      <Alert variant="info" title="Where do these values appear?">
        The identity block is printed on quotes and invoices. The default VAT rate and payment terms
        pre-fill new documents — the workspace slug is{' '}
        <code className="rounded bg-white px-1 py-0.5 text-xs">{organization.slug}</code>.
      </Alert>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Company profile</CardTitle>
            <CardDescription>
              Created on {formatDate(organization.created_at)} · last updated{' '}
              {formatDate(organization.updated_at, 'dd/MM/yyyy HH:mm')}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <OrganizationProfileForm organization={organization} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Numbering</CardTitle>
          <CardDescription>Per-organisation sequences, assigned by the database.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600">
          <ul className="space-y-1">
            <li>
              Interventions: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">INT-00001</code>
            </li>
            <li>
              Quotes: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">QUO-00001</code>
            </li>
            <li>
              Invoices: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">INV-00001</code>
            </li>
          </ul>
          <p>
            Numbers are allocated atomically by PostgreSQL triggers, so two users saving at the same
            time can never end up with the same reference.
          </p>
          <p className="text-xs text-slate-500">
            Need a custom prefix? Update the <code>document_sequences</code> row for your
            organisation — see <Link href="/setup" className="underline">the setup guide</Link>.
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
