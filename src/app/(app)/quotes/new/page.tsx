import { QuoteForm, type QuoteFormDefaults } from '@/components/quotes/quote-form';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { requireCapability } from '@/lib/auth/session';
import { listCustomerOptions } from '@/lib/db/interventions';
import { toDateInputValue } from '@/lib/utils/format';

export const metadata = { title: 'New quote' };

function plusDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

export default async function NewQuotePage() {
  const session = await requireCapability('quotes.manage', '/quotes/new');
  const organizationId = session.organization.id;

  const customers = await listCustomerOptions(organizationId);

  const defaults: QuoteFormDefaults = {
    id: null,
    customerId: '',
    interventionId: null,
    status: 'draft',
    issueDate: toDateInputValue(new Date()),
    validUntil: plusDays(30),
    discountType: 'none',
    discountValue: '0',
    notes: '',
    internalNotes: '',
    lines: [],
  };

  return (
    <PageContainer>
      <PageHeader
        title="New quote"
        description="Price the job line by line; totals and the quote number are computed on save."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Quotes', href: '/quotes' },
          { label: 'New' },
        ]}
      />
      <QuoteForm
        mode="create"
        customers={customers}
        defaults={defaults}
        currency={session.organization.currency}
        cancelHref="/quotes"
      />
    </PageContainer>
  );
}
