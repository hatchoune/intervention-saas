import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { InvoiceForm, type InvoiceFormDefaults } from '@/components/invoices/invoice-form';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { requireCapability } from '@/lib/auth/session';
import { getInvoiceDetail } from '@/lib/db/invoices';
import { listCustomerOptions } from '@/lib/db/interventions';
import { toEditableLines } from '@/lib/validation/document';

export const metadata = { title: 'Edit invoice' };

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireCapability('invoices.manage', `/invoices/${id}/edit`);
  const organizationId = session.organization.id;

  const detail = await getInvoiceDetail(organizationId, id);
  if (!detail) notFound();

  // Only drafts are editable (the server action refuses the others too).
  if (detail.invoice.status !== 'draft') redirect(`/invoices/${detail.invoice.id}`);

  const customers = await listCustomerOptions(organizationId, { includeArchived: true });
  const { invoice } = detail;

  const defaults: InvoiceFormDefaults = {
    id: invoice.id,
    customerId: invoice.customer_id,
    interventionId: invoice.intervention_id,
    status: invoice.status,
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date ?? '',
    discountType: invoice.discount_type,
    discountValue: String(invoice.discount_value),
    notes: invoice.notes ?? '',
    internalNotes: invoice.internal_notes ?? '',
    paymentTerms: invoice.payment_terms ?? '',
    paymentMethod: invoice.payment_method ?? '',
    amountPaid: String(invoice.amount_paid),
    lines: toEditableLines(detail.items),
  };

  return (
    <PageContainer>
      <PageHeader
        title={`Edit invoice ${invoice.invoice_number}`}
        description="Only draft invoices can be edited — send it to lock the content."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Invoices', href: '/invoices' },
          { label: invoice.invoice_number, href: `/invoices/${invoice.id}` },
          { label: 'Edit' },
        ]}
        actions={
          <Link href={`/invoices/${invoice.id}`} className="text-sm text-slate-500 hover:underline">
            Back to invoice
          </Link>
        }
      />
      <InvoiceForm
        mode="update"
        customers={customers}
        defaults={defaults}
        currency={session.organization.currency}
        cancelHref={`/invoices/${invoice.id}`}
      />
    </PageContainer>
  );
}
