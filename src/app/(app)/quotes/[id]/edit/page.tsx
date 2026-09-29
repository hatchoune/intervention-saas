import { QuoteForm, type QuoteFormDefaults } from '@/components/quotes/quote-form';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { requireCapability } from '@/lib/auth/session';
import { getQuoteDetail } from '@/lib/db/quotes';
import { listCustomerOptions } from '@/lib/db/interventions';
import { toEditableLines } from '@/lib/validation/document';
import { redirect, notFound } from 'next/navigation';

export const metadata = { title: 'Edit quote' };

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireCapability('quotes.manage', `/quotes/${id}/edit`);
  const organizationId = session.organization.id;

  const detail = await getQuoteDetail(organizationId, id);
  if (!detail) notFound();

  // Accepted quotes are frozen (the server action refuses them too).
  if (detail.quote.status === 'accepted') redirect(`/quotes/${detail.quote.id}`);

  const customers = await listCustomerOptions(organizationId, { includeArchived: true });

  const defaults: QuoteFormDefaults = {
    id: detail.quote.id,
    customerId: detail.quote.customer_id,
    interventionId: detail.quote.intervention_id,
    status: detail.quote.status,
    issueDate: detail.quote.issue_date,
    validUntil: detail.quote.valid_until ?? '',
    discountType: detail.quote.discount_type,
    discountValue: String(detail.quote.discount_value),
    notes: detail.quote.notes ?? '',
    internalNotes: detail.quote.internal_notes ?? '',
    lines: toEditableLines(detail.items),
  };

  return (
    <PageContainer>
      <PageHeader
        title={`Edit quote ${detail.quote.quote_number}`}
        description="Accepted quotes cannot be edited — the status control handles the lifecycle."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Quotes', href: '/quotes' },
          { label: detail.quote.quote_number, href: `/quotes/${detail.quote.id}` },
          { label: 'Edit' },
        ]}
      />
      <QuoteForm
        mode="update"
        customers={customers}
        defaults={defaults}
        currency={session.organization.currency}
        cancelHref={`/quotes/${detail.quote.id}`}
      />
    </PageContainer>
  );
}
