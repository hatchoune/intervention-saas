import {
  InterventionForm,
  type InterventionFormDefaults,
} from '@/components/interventions/intervention-form';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { requireCapability } from '@/lib/auth/session';
import {
  listCustomerAddressOptions,
  listCustomerOptions,
  listTechnicianOptions,
} from '@/lib/db/interventions';
import { INTERVENTION_STATUSES } from '@/lib/domain/status';

/** All statuses are reachable on creation; transitions are checked afterwards. */
export default async function NewInterventionPage() {
  const session = await requireCapability('interventions.manage', '/interventions/new');
  const organizationId = session.organization.id;

  const [customers, addresses, technicians] = await Promise.all([
    listCustomerOptions(organizationId),
    listCustomerAddressOptions(organizationId),
    listTechnicianOptions(organizationId),
  ]);

  const defaults: InterventionFormDefaults = {
    id: null,
    customerId: '',
    customerAddressId: '',
    technicianId: '',
    title: '',
    description: '',
    internalNotes: '',
    status: 'draft',
    priority: 'normal',
    scheduledStart: null,
    scheduledEnd: null,
    addressLine1: '',
    addressLine2: '',
    postalCode: '',
    city: '',
    country: 'FR',
  };

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        title="New intervention"
        description="Schedule a job for a customer. The reference is generated on save."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Interventions', href: '/interventions' },
          { label: 'New' },
        ]}
      />

      {customers.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Add a customer first — an intervention always belongs to one.
        </p>
      ) : null}

      <InterventionForm
        mode="create"
        customers={customers}
        addresses={addresses}
        technicians={technicians}
        defaults={defaults}
        allowedStatuses={INTERVENTION_STATUSES}
        canEditInternalNotes
        cancelHref="/interventions"
      />
    </PageContainer>
  );
}
