import { notFound, redirect } from 'next/navigation';

import {
  InterventionForm,
  type InterventionFormDefaults,
} from '@/components/interventions/intervention-form';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { requireOrganization } from '@/lib/auth/session';
import {
  getIntervention,
  listCustomerAddressOptions,
  listCustomerOptions,
  listTechnicianOptions,
} from '@/lib/db/interventions';
import { can, canEditIntervention } from '@/lib/domain/permissions';
import { INTERVENTION_STATUS_TRANSITIONS } from '@/lib/domain/status';

export default async function EditInterventionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireOrganization(`/interventions/${id}/edit`);
  const organizationId = session.organization.id;

  const detail = await getIntervention(organizationId, id);
  if (!detail) notFound();

  const mayEdit = canEditIntervention(session.role, {
    assignedTechnicianUserId: detail.technician?.user_id ?? null,
    userId: session.user.id,
  });

  if (!mayEdit) redirect(`/interventions/${id}?error=forbidden`);

  const [customers, addresses, technicians] = await Promise.all([
    listCustomerOptions(organizationId, { includeArchived: true }),
    listCustomerAddressOptions(organizationId),
    listTechnicianOptions(organizationId, { includeInactive: true }),
  ]);

  const { intervention, customerAddress } = detail;

  const defaults: InterventionFormDefaults = {
    id: intervention.id,
    customerId: intervention.customer_id,
    customerAddressId: intervention.customer_address_id ?? '',
    technicianId: intervention.technician_id ?? '',
    title: intervention.title,
    description: intervention.description ?? '',
    internalNotes: intervention.internal_notes ?? '',
    status: intervention.status,
    priority: intervention.priority,
    scheduledStart: intervention.scheduled_start,
    scheduledEnd: intervention.scheduled_end,
    addressLine1: intervention.address_line1 ?? customerAddress?.address_line1 ?? '',
    addressLine2: intervention.address_line2 ?? customerAddress?.address_line2 ?? '',
    postalCode: intervention.postal_code ?? customerAddress?.postal_code ?? '',
    city: intervention.city ?? customerAddress?.city ?? '',
    country: intervention.country ?? customerAddress?.country ?? 'FR',
  };

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        title={`Edit ${intervention.reference}`}
        description={intervention.title}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Interventions', href: '/interventions' },
          { label: intervention.reference, href: `/interventions/${intervention.id}` },
          { label: 'Edit' },
        ]}
      />

      <InterventionForm
        mode="update"
        customers={customers}
        addresses={addresses}
        technicians={technicians}
        defaults={defaults}
        allowedStatuses={INTERVENTION_STATUS_TRANSITIONS[intervention.status]}
        canEditInternalNotes={can('interventions.manage', session.role)}
        cancelHref={`/interventions/${intervention.id}`}
      />
    </PageContainer>
  );
}
