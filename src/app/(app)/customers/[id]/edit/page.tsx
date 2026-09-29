import { notFound } from 'next/navigation';

import {
  CustomerForm,
  type CustomerFormDefaults,
} from '@/components/customers/customer-form';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { requireCapability } from '@/lib/auth/session';
import { getCustomer } from '@/lib/db/customers';

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireCapability('customers.manage', `/customers/${id}/edit`);

  const customer = await getCustomer(session.organization.id, id);
  if (!customer) notFound();

  const defaults: CustomerFormDefaults = {
    id: customer.id,
    type: customer.type,
    status: customer.status,
    firstName: customer.first_name ?? '',
    lastName: customer.last_name ?? '',
    companyName: customer.company_name ?? '',
    contactName: customer.contact_name ?? '',
    email: customer.email ?? '',
    phone: customer.phone ?? '',
    mobile: customer.mobile ?? '',
    website: customer.website ?? '',
    vatNumber: customer.vat_number ?? '',
    registrationNumber: customer.registration_number ?? '',
    addressLine1: customer.address_line1 ?? '',
    addressLine2: customer.address_line2 ?? '',
    postalCode: customer.postal_code ?? '',
    city: customer.city ?? '',
    country: customer.country ?? 'FR',
    tags: customer.tags.join(', '),
    notes: customer.notes ?? '',
  };

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        title={`Edit ${customer.name}`}
        description="Contact details, billing address and internal notes."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Customers', href: '/customers' },
          { label: customer.name, href: `/customers/${customer.id}` },
          { label: 'Edit' },
        ]}
      />

      <CustomerForm mode="update" defaults={defaults} cancelHref={`/customers/${customer.id}`} />
    </PageContainer>
  );
}
