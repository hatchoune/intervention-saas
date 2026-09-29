import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil, Printer } from 'lucide-react';

import { DocumentActivity } from '@/components/documents/document-activity';
import { DocumentItemsTable } from '@/components/documents/document-items-table';
import {
  DeleteInvoiceAction,
  InvoiceStatusControl,
  RecordPaymentAction,
} from '@/components/invoices/invoice-actions';
import { Badge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/data-display';
import { EmptyState } from '@/components/ui/empty-state';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { MetaItem, MetaList, SummaryRow } from '@/components/ui/table';
import { requireOrganization } from '@/lib/auth/session';
import { getInvoiceDetail } from '@/lib/db/invoices';
import { can } from '@/lib/domain/permissions';
import { DISCOUNT_TYPE_LABELS, INVOICE_STATUS_META } from '@/lib/domain/status';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Invoice' };

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireOrganization(`/invoices/${id}`);
  const detail = await getInvoiceDetail(session.organization.id, id);
  if (!detail) notFound();

  const { invoice, customer, intervention, quote, items, activity, balance, effectiveStatus } =
    detail;
  const canManage = can('invoices.manage', session.role);
  const meta = INVOICE_STATUS_META[effectiveStatus];
  const currency = invoice.currency || session.organization.currency;

  const storedStatus = invoice.status;
  const canPay =
    balance > 0 && storedStatus !== 'draft' && storedStatus !== 'cancelled';

  const discountLabel =
    invoice.discount_type === 'none'
      ? DISCOUNT_TYPE_LABELS.none
      : `${invoice.discount_value}${invoice.discount_type === 'percentage' ? '%' : ''} — ${DISCOUNT_TYPE_LABELS[invoice.discount_type]}`;

  return (
    <PageContainer>
      <Link
        href="/invoices"
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft aria-hidden className="size-4" />
        All invoices
      </Link>

      <PageHeader
        title={`Invoice ${invoice.invoice_number}`}
        description={
          customer
            ? `${customer.name} · issued ${formatDate(invoice.issue_date)}${
                invoice.due_date ? ` · due ${formatDate(invoice.due_date)}` : ''
              }`
            : `Issued ${formatDate(invoice.issue_date)}`
        }
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Invoices', href: '/invoices' },
          { label: invoice.invoice_number },
        ]}
        actions={
          <>
            <Badge tone={meta.tone}>{meta.label}</Badge>
            <Link
              href={`/invoices/${invoice.id}/print`}
              className={buttonClasses('outline', 'md')}
            >
              <Printer aria-hidden className="size-4" />
              Print
            </Link>
            {canManage && canPay ? (
              <RecordPaymentAction
                invoiceId={invoice.id}
                invoiceNumber={invoice.invoice_number}
                total={Number(invoice.total)}
                amountPaid={Number(invoice.amount_paid)}
                balance={balance}
                currency={currency}
              />
            ) : null}
            {canManage && storedStatus === 'draft' ? (
              <Link
                href={`/invoices/${invoice.id}/edit`}
                className={buttonClasses('outline', 'md')}
              >
                <Pencil aria-hidden className="size-4" />
                Edit
              </Link>
            ) : null}
            {canManage && storedStatus === 'draft' ? (
              <DeleteInvoiceAction
                invoiceId={invoice.id}
                invoiceNumber={invoice.invoice_number}
              />
            ) : null}
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total" value={formatCurrency(invoice.total, currency)} hint="Including VAT" />
        <StatCard
          label="Paid"
          value={formatCurrency(invoice.amount_paid, currency)}
          hint={invoice.payment_method ? `Via ${invoice.payment_method}` : 'No method recorded'}
          tone={Number(invoice.amount_paid) > 0 ? 'accent' : 'default'}
        />
        <StatCard
          label="Balance"
          value={formatCurrency(balance, currency)}
          hint={balance > 0 ? 'Still due' : 'Settled in full'}
          tone={balance > 0 ? (effectiveStatus === 'overdue' ? 'danger' : 'warning') : 'success'}
        />
      </div>

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
                <DocumentItemsTable items={items} currency={currency} />
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
                value={formatCurrency(invoice.subtotal, currency)}
              />
              <SummaryRow
                label="Global discount"
                value={`− ${formatCurrency(invoice.discount_total, currency)}`}
              />
              <SummaryRow label="Net total" value={formatCurrency(invoice.net_total, currency)} />
              <SummaryRow label="VAT" value={formatCurrency(invoice.vat_total, currency)} />
              <SummaryRow
                label="Total (incl. VAT)"
                value={formatCurrency(invoice.total, currency)}
                emphasis
              />
              <SummaryRow
                label="Amount paid"
                value={`− ${formatCurrency(invoice.amount_paid, currency)}`}
              />
              <SummaryRow
                label="Balance due"
                value={formatCurrency(balance, currency)}
                emphasis
              />
            </CardContent>
          </Card>

          {invoice.notes ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">Notes for the customer</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap text-slate-700">{invoice.notes}</p>
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
                <MetaItem label="Issued">{formatDate(invoice.issue_date)}</MetaItem>
                <MetaItem label="Due date">
                  {invoice.due_date ? formatDate(invoice.due_date) : 'No deadline'}
                </MetaItem>
                <MetaItem label="Payment terms">{invoice.payment_terms || '—'}</MetaItem>
                <MetaItem label="Paid on">
                  {invoice.paid_at ? formatDateTime(invoice.paid_at) : 'Not settled'}
                </MetaItem>
                <MetaItem label="Global discount">{discountLabel}</MetaItem>
                <MetaItem label="From quote">
                  {quote ? (
                    <Link
                      href={`/quotes/${quote.id}`}
                      className="text-indigo-700 hover:underline"
                    >
                      {quote.quote_number}
                    </Link>
                  ) : (
                    '—'
                  )}
                </MetaItem>
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
                <InvoiceStatusControl invoiceId={invoice.id} status={storedStatus} />
                <p className="text-xs text-slate-500">
                  Payments update the status automatically ({'sent'} → partial → paid). Manual
                  moves are limited to sending and cancelling.
                </p>
                {invoice.sent_at ? (
                  <p className="text-xs text-slate-500">Sent {formatDateTime(invoice.sent_at)}.</p>
                ) : null}
                {invoice.cancelled_at ? (
                  <p className="text-xs text-slate-500">
                    Cancelled {formatDateTime(invoice.cancelled_at)}.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {canManage && invoice.internal_notes ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">Internal notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap text-slate-700">
                  {invoice.internal_notes}
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
