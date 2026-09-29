import { notFound } from 'next/navigation';

import { DocumentItemsTable } from '@/components/documents/document-items-table';
import { PrintToolbar } from '@/components/documents/print-toolbar';
import { Badge } from '@/components/ui/badge';
import { PageContainer } from '@/components/ui/page-header';
import { SummaryRow } from '@/components/ui/table';
import { requireOrganization } from '@/lib/auth/session';
import { getCustomer } from '@/lib/db/customers';
import { getInvoiceDetail } from '@/lib/db/invoices';
import { INVOICE_STATUS_META } from '@/lib/domain/status';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import type { CustomerRow } from '@/types/database';

export const metadata = { title: 'Print invoice' };

function customerAddress(customer: CustomerRow): string[] {
  return [
    customer.address_line1 ?? '',
    customer.address_line2 ?? '',
    [customer.postal_code, customer.city].filter(Boolean).join(' '),
    customer.country ?? '',
  ].filter(Boolean);
}

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireOrganization(`/invoices/${id}/print`);
  const organizationId = session.organization.id;

  const detail = await getInvoiceDetail(organizationId, id);
  if (!detail) notFound();

  const { invoice, items, intervention, quote, balance, effectiveStatus } = detail;
  const customer = invoice.customer_id
    ? await getCustomer(organizationId, invoice.customer_id)
    : null;

  const org = session.organization;
  const meta = INVOICE_STATUS_META[effectiveStatus];
  const address = customer ? customerAddress(customer) : [];

  return (
    <PageContainer className="max-w-4xl">
      <PrintToolbar
        backHref={`/invoices/${invoice.id}`}
        backLabel={`Back to invoice ${invoice.invoice_number}`}
      />

      <article className="print-page space-y-8 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <header className="print-avoid-break flex flex-wrap items-start justify-between gap-8">
          <div className="min-w-0 space-y-2">
            {org.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- logos may be external URLs
              <img src={org.logo_url} alt={org.name} className="h-12 w-auto" />
            ) : null}
            <p className="text-lg font-semibold text-slate-900">{org.legal_name || org.name}</p>
            <address className="space-y-0.5 text-sm not-italic text-slate-600">
              {org.address_line1 ? <p>{org.address_line1}</p> : null}
              {org.address_line2 ? <p>{org.address_line2}</p> : null}
              <p>
                {[org.postal_code, org.city].filter(Boolean).join(' ')}
                {org.country ? ` ${org.country}` : ''}
              </p>
              {org.email ? <p>{org.email}</p> : null}
              {org.phone ? <p>{org.phone}</p> : null}
            </address>
            <div className="space-y-0.5 text-sm text-slate-600">
              {org.vat_number ? <p>VAT number: {org.vat_number}</p> : null}
              {org.registration_number ? <p>Reg. no.: {org.registration_number}</p> : null}
            </div>
          </div>

          <div className="text-right">
            <p className="text-2xl font-semibold tracking-tight text-slate-900">INVOICE</p>
            <p className="font-mono text-sm text-slate-600">{invoice.invoice_number}</p>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-end gap-3 text-slate-500">
                <dt>Issued</dt>
                <dd className="font-medium text-slate-800">{formatDate(invoice.issue_date)}</dd>
              </div>
              <div className="flex justify-end gap-3 text-slate-500">
                <dt>Due date</dt>
                <dd className="font-medium text-slate-800">
                  {invoice.due_date ? formatDate(invoice.due_date) : '—'}
                </dd>
              </div>
              <div className="flex justify-end gap-3 text-slate-500">
                <dt>Currency</dt>
                <dd className="font-medium text-slate-800">{invoice.currency}</dd>
              </div>
            </dl>
            <div className="mt-2 flex justify-end">
              <Badge tone={meta.tone}>{meta.label}</Badge>
            </div>
          </div>
        </header>
          <section className="print-avoid-break">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Invoice for</p>
          <div className="mt-1 space-y-0.5 text-sm text-slate-700">
            <p className="text-base font-semibold text-slate-900">{customer?.name ?? '—'}</p>
            {address.map((line) => (
              <p key={line}>{line}</p>
            ))}
            {customer?.email ? <p>{customer.email}</p> : null}
            {customer?.phone ?? customer?.mobile ? (
              <p>{customer?.phone ?? customer?.mobile}</p>
            ) : null}
          </div>
          <div className="mt-2 space-y-0.5 text-sm text-slate-500">
            {quote ? (
              <p>
                From quote {quote.quote_number} ({quote.issue_date ? formatDate(quote.issue_date) : ''})
              </p>
            ) : null}
            {intervention ? (
              <p>
                Related intervention: {intervention.reference} — {intervention.title}
              </p>
            ) : null}
            {invoice.payment_terms ? <p>Payment terms: {invoice.payment_terms}</p> : null}
          </div>
        </section>

        <section>
          <DocumentItemsTable items={items} currency={invoice.currency} />
        </section>

        <section className="print-avoid-break flex justify-end">
          <div className="w-full max-w-sm space-y-1">
            <SummaryRow
              label="Subtotal (excl. VAT)"
              value={formatCurrency(invoice.subtotal, invoice.currency)}
            />
            <SummaryRow
              label="Global discount"
              value={`− ${formatCurrency(invoice.discount_total, invoice.currency)}`}
            />
            <SummaryRow label="Net total" value={formatCurrency(invoice.net_total, invoice.currency)} />
            <SummaryRow label="VAT" value={formatCurrency(invoice.vat_total, invoice.currency)} />
            <SummaryRow
              label="Total (incl. VAT)"
              value={formatCurrency(invoice.total, invoice.currency)}
              emphasis
            />
            <SummaryRow
              label="Amount paid"
              value={`− ${formatCurrency(invoice.amount_paid, invoice.currency)}`}
            />
            <SummaryRow
              label="Balance due"
              value={formatCurrency(balance, invoice.currency)}
              emphasis
            />
          </div>
        </section>

        {invoice.notes ? (
          <section className="print-avoid-break space-y-1">
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Notes</p>
            <p className="text-sm whitespace-pre-wrap text-slate-700">{invoice.notes}</p>
          </section>
        ) : null}

        <footer className="print-avoid-break border-t border-slate-200 pt-4 text-xs whitespace-pre-wrap text-slate-500">
          {org.invoice_footer ??
            `${org.legal_name || org.name} — ${[org.postal_code, org.city].filter(Boolean).join(' ')}${org.vat_number ? ` — VAT ${org.vat_number}` : ''}`}
        </footer>
      </article>
    </PageContainer>
  );
}
