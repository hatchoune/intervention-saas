import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil, Printer, Receipt } from 'lucide-react';

import { DocumentActivity } from '@/components/documents/document-activity';
import { DocumentItemsTable } from '@/components/documents/document-items-table';
import {
  ConvertQuoteToInvoiceAction,
  DeleteQuoteAction,
  QuoteStatusControl,
} from '@/components/quotes/quote-actions';
import { Badge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { MetaItem, MetaList, SummaryRow } from '@/components/ui/table';
import { requireOrganization } from '@/lib/auth/session';
import { getQuoteDetail } from '@/lib/db/quotes';
import { can } from '@/lib/domain/permissions';
import {
  DISCOUNT_TYPE_LABELS,
  QUOTE_STATUS_META,
  isQuoteInvoicable,
} from '@/lib/domain/status';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Quote' };

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireOrganization(`/quotes/${id}`);
  const detail = await getQuoteDetail(session.organization.id, id);
  if (!detail) notFound();

  const { quote, customer, intervention, items, activity } = detail;
  const canManage = can('quotes.manage', session.role);
  const meta = QUOTE_STATUS_META[quote.status];
  const invoicable = isQuoteInvoicable(quote);

  const discountLabel =
    quote.discount_type === 'none'
      ? DISCOUNT_TYPE_LABELS.none
      : `${quote.discount_value}${quote.discount_type === 'percentage' ? '%' : ''} — ${DISCOUNT_TYPE_LABELS[quote.discount_type]}`;

  return (
    <PageContainer>
      <Link
        href="/quotes"
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft aria-hidden className="size-4" />
        All quotes
      </Link>

      <PageHeader
        title={`Quote ${quote.quote_number}`}
        description={
          customer
            ? `${customer.name} · issued ${formatDate(quote.issue_date)}`
            : `Issued ${formatDate(quote.issue_date)}`
        }
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Quotes', href: '/quotes' },
          { label: quote.quote_number },
        ]}
        actions={
          <>
            <Badge tone={meta.tone}>{meta.label}</Badge>
            <Link
              href={`/quotes/${quote.id}/print`}
              className={buttonClasses('outline', 'md')}
            >
              <Printer aria-hidden className="size-4" />
              Print
            </Link>
            {canManage && quote.status !== 'accepted' ? (
              <Link
                href={`/quotes/${quote.id}/edit`}
                className={buttonClasses('outline', 'md')}
              >
                <Pencil aria-hidden className="size-4" />
                Edit
              </Link>
            ) : null}
            {canManage && invoicable ? (
              <ConvertQuoteToInvoiceAction quoteId={quote.id} />
            ) : null}
            {canManage && quote.status === 'draft' ? (
              <DeleteQuoteAction quoteId={quote.id} quoteNumber={quote.quote_number} />
            ) : null}
          </>
        }
      />
      {quote.converted_invoice_id ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
            <p className="text-slate-600">This quote has been converted into an invoice.</p>
            <Link
              href={`/invoices/${quote.converted_invoice_id}`}
              className={buttonClasses('success', 'sm')}
            >
              <Receipt aria-hidden className="size-4" />
              View invoice
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle as="h2">Line items</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {items.length === 0 ? (
                <EmptyState
                  className="border-0"
                  title="No line item yet"
                  description="Add the priced lines from the edit page."
                />
              ) : (
                <DocumentItemsTable items={items} currency={quote.currency} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <SummaryRow
                label="Subtotal (excl. VAT)"
                value={formatCurrency(quote.subtotal, quote.currency)}
              />
              <SummaryRow
                label="Global discount"
                value={`− ${formatCurrency(quote.discount_total, quote.currency)}`}
              />
              <SummaryRow
                label="Net total"
                value={formatCurrency(quote.net_total, quote.currency)}
              />
              <SummaryRow
                label="VAT"
                value={formatCurrency(quote.vat_total, quote.currency)}
              />
              <SummaryRow
                label="Total (incl. VAT)"
                value={formatCurrency(quote.total, quote.currency)}
                emphasis
              />
            </CardContent>
          </Card>

          {quote.notes ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">Notes for the customer</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap text-slate-700">{quote.notes}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle as="h2">Details</CardTitle>
            </CardHeader>
            <CardContent>
              <MetaList>
                <MetaItem label="Customer">
                  {customer ? (
                    <Link
                      href={`/customers/${customer.id}`}
                      className="text-indigo-700 hover:underline"
                    >
                      {customer.name}
                    </Link>
                  ) : (
                    '—'
                  )}
                </MetaItem>
                <MetaItem label="Status">
                  {meta.label} — {meta.description}
                </MetaItem>
                <MetaItem label="Issued">{formatDate(quote.issue_date)}</MetaItem>
                <MetaItem label="Valid until">
                  {quote.valid_until ? formatDate(quote.valid_until) : 'No expiry'}
                </MetaItem>
                <MetaItem label="Currency">{quote.currency}</MetaItem>
                <MetaItem label="Global discount">{discountLabel}</MetaItem>
                <MetaItem label="Intervention">
                  {intervention ? (
                    <Link
                      href={`/interventions/${intervention.id}`}
                      className="text-indigo-700 hover:underline"
                    >
                      {intervention.reference}
                    </Link>
                  ) : (
                    '—'
                  )}
                </MetaItem>
              </MetaList>
            </CardContent>
          </Card>

          {canManage ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <QuoteStatusControl quoteId={quote.id} status={quote.status} />
                <div className="space-y-1 text-xs text-slate-500">
                  {quote.sent_at ? <p>Sent {formatDateTime(quote.sent_at)}.</p> : null}
                  {quote.accepted_at ? <p>Accepted {formatDateTime(quote.accepted_at)}.</p> : null}
                  {quote.rejected_at ? <p>Rejected {formatDateTime(quote.rejected_at)}.</p> : null}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {canManage && quote.internal_notes ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">Internal notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap text-slate-700">
                  {quote.internal_notes}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle as="h2">Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentActivity rows={activity} />
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
