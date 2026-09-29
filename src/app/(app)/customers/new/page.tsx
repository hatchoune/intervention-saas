import {
  CustomerForm,
  type CustomerFormDefaults,
} from '@/components/customers/customer-form';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { requireCapability } from '@/lib/auth/session';

export default async function NewCustomerPage() {
  await requireCapability('customers.manage', '/customers/new');

  const defaults: CustomerFormDefaults = {
    id: null,
    type: 'individual',
    status: 'active',
    firstName: '',
    lastName: '',
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    mobile: '',
    website: '',
    vatNumber: '',
    registrationNumber: '',
    addressLine1: '',
    addressLine2: '',
    postalCode: '',
    city: '',
    country: 'FR',
    tags: '',
    notes: '',
  };

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        title="New customer"
        description="Individuals and companies are both supported; add service addresses afterwards."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Customers', href: '/customers' },
          { label: 'New' },
        ]}
      />

      <CustomerForm mode="create" defaults={defaults} cancelHref="/customers" />
    </PageContainer>
  );
}
