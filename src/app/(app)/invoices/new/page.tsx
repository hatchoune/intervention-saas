import { InvoiceFromInterventionAction } from '@/components/invoices/invoice-generate';
import { InvoiceForm, type InvoiceFormDefaults } from '@/components/invoices/invoice-form';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { requireCapability } from '@/lib/auth/session';
import { listBillableInterventions } from '@/lib/db/invoices';
import { listCustomerOptions } from '@/lib/db/interventions';
import { toDateInputValue } from '@/lib/utils/format';

export const metadata = { title: 'New invoice' };

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCapability('invoices.manage', '/invoices/new');
  const organizationId = session.organization.id;
  const params = await searchParams;

  const rawCustomer = Array.isArray(params.customerId)
    ? (params.customerId[0] ?? '')
    : (params.customerId ?? '');

  const [customers, billable] = await Promise.all([
    listCustomerOptions(organizationId),
    listBillableInterventions(organizationId),
  ]);

  const customerId = customers.some((customer) => customer.id === rawCustomer)
    ? rawCustomer
    : '';

  const defaults: InvoiceFormDefaults = {
    id: null,
    customerId,
    interventionId: null,
    status: 'draft',
    issueDate: toDateInputValue(new Date()),
    dueDate: '',
    discountType: 'none',
    discountValue: '0',
    notes: '',
    internalNotes: '',
    paymentTerms: '',
    paymentMethod: '',
    amountPaid: '0',
    lines: [],
  };

  return (
    <PageContainer>
      <PageHeader
        title="New invoice"
        description="Price it manually, or generate one from a completed intervention (accepted quotes are billed automatically)."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Invoices', href: '/invoices' },
          { label: 'New' },
        ]}
        actions={<InvoiceFromInterventionAction interventions={billable} />}
      />
      <InvoiceForm
        mode="create"
        customers={customers}
        defaults={defaults}
        currency={session.organization.currency}
        cancelHref="/invoices"
      />
    </PageContainer>
  );
}
