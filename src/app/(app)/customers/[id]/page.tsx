import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, FileText, Pencil, Plus, Receipt, Wrench } from 'lucide-react';

import { CustomerAddressManager } from '@/components/customers/customer-address-manager';
import {
  CustomerStatusToggle,
  DeleteCustomerAction,
} from '@/components/customers/customer-actions';
import { InterventionCompactList } from '@/components/interventions/intervention-compact-list';
import { Badge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/data-display';
import { EmptyState } from '@/components/ui/empty-state';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { MetaItem, MetaList } from '@/components/ui/table';
import { requireOrganization } from '@/lib/auth/session';
import {
  getCustomer,
  getCustomerAddresses,
  getCustomerInterventions,
  getCustomerInvoices,
  getCustomerQuotes,
  getCustomerStats,
} from '@/lib/db/customers';
import { can } from '@/lib/domain/permissions';
import { CUSTOMER_STATUS_META, CUSTOMER_TYPE_META, INVOICE_STATUS_META, QUOTE_STATUS_META, effectiveInvoiceStatus } from '@/lib/domain/status';
import { formatCurrency, formatDate } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Customer' };

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireOrganization(`/customers/${id}`);
  const organizationId = session.organization.id;

  const customer = await getCustomer(organizationId, id);
  if (!customer) notFound();

  const [addresses, stats, interventions, quotes, invoices] = await Promise.all([
    getCustomerAddresses(organizationId, customer.id),
    getCustomerStats(organizationId, customer.id),
    getCustomerInterventions(organizationId, customer.id),
    getCustomerQuotes(organizationId, customer.id),
    getCustomerInvoices(organizationId, customer.id),
  ]);

  const canManage = can('customers.manage', session.role);
  const canBill = can('invoices.manage', session.role);
  const currency = session.organization.currency;

  return (
    <PageContainer>
      <Link
        href="/customers"
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft aria-hidden className="size-4" />
        All customers
      </Link>

      <PageHeader
        title={customer.name}
        description={
          customer.type === 'company'
            ? `${CUSTOMER_TYPE_META.company.label}${customer.contact_name ? ` · contact ${customer.contact_name}` : ''}`
            : CUSTOMER_TYPE_META.individual.label
        }
        actions={
          <>
            <Badge tone={customer.status === 'active' ? 'success' : 'neutral'}>
              {CUSTOMER_STATUS_META[customer.status].label}
            </Badge>
            {canManage ? (
              <>
                <Link
                  href={`/customers/${customer.id}/edit`}
                  className={buttonClasses('outline', 'md')}
                >
                  <Pencil aria-hidden className="size-4" />
                  Edit
                </Link>
                <CustomerStatusToggle
                  customerId={customer.id}
                  status={customer.status}
                  customerName={customer.name}
                />
                <DeleteCustomerAction customerId={customer.id} customerName={customer.name} />
              </>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Interventions"
          value={stats.interventions}
          hint="All time"
          icon={<Wrench aria-hidden className="size-4" />}
        />
        <StatCard label="Quotes" value={stats.quotes} hint="All time" />
        <StatCard
          label="Invoiced"
          value={formatCurrency(stats.invoicedTotal, currency)}
          hint="Excluding cancelled"
          tone="accent"
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(stats.outstandingTotal, currency)}
          hint="Issued and not fully paid"
          tone={stats.outstandingTotal > 0 ? 'warning' : 'success'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle as="h2">Intervention history</CardTitle>
              {canManage ? (
                <Link
                  href={`/interventions/new?customerId=${customer.id}`}
                  className={buttonClasses('outline', 'sm')}
                >
                  <Plus aria-hidden className="size-3.5" />
                  New intervention
                </Link>
              ) : null}
            </CardHeader>
            <CardContent>
              {interventions.length === 0 ? (
                <EmptyState
                  title="No intervention yet"
                  description="Every job done for this customer will be listed here."
                />
              ) : (
                <InterventionCompactList rows={interventions} emptyLabel="No intervention yet." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">Quotes</CardTitle>
              {canBill ? (
                <Link
                  href={`/quotes/new?customerId=${customer.id}`}
                  className={buttonClasses('outline', 'sm')}
                >
                  <FileText aria-hidden className="size-3.5" />
                  New quote
                </Link>
              ) : null}
            </CardHeader>
            <CardContent>
              {quotes.length === 0 ? (
                <p className="text-sm text-slate-500">No quote issued for this customer.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {quotes.map((quote) => (
                    <li
                      key={quote.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-3"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/quotes/${quote.id}`}
                          className="text-sm font-medium text-indigo-700 hover:underline"
                        >
                          {quote.quote_number}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {formatDate(quote.issue_date)} · {formatCurrency(quote.total, quote.currency)}
                        </p>
                      </div>
                      <Badge tone={QUOTE_STATUS_META[quote.status].tone}>
                        {QUOTE_STATUS_META[quote.status].label}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">Invoices</CardTitle>
              {canBill ? (
                <Link
                  href={`/invoices/new?customerId=${customer.id}`}
                  className={buttonClasses('outline', 'sm')}
                >
                  <Receipt aria-hidden className="size-3.5" />
                  New invoice
                </Link>
              ) : null}
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <p className="text-sm text-slate-500">No invoice issued for this customer yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {invoices.map((invoice) => {
                    const status = effectiveInvoiceStatus(invoice);
                    const balance = Number(invoice.total) - Number(invoice.amount_paid);

                    return (
                      <li
                        key={invoice.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-3"
                      >
                        <div className="min-w-0">
                          <Link
                            href={`/invoices/${invoice.id}`}
                            className="text-sm font-medium text-indigo-700 hover:underline"
                          >
                            {invoice.invoice_number}
                          </Link>
                          <p className="text-xs text-slate-500">
                            {formatDate(invoice.issue_date)} ·{' '}
                            {formatCurrency(invoice.total, invoice.currency)}
                            {balance > 0 && status !== 'draft' && status !== 'cancelled'
                              ? ` · ${formatCurrency(balance, invoice.currency)} due`
                              : ''}
                          </p>
                        </div>
                        <Badge tone={INVOICE_STATUS_META[status].tone}>
                          {INVOICE_STATUS_META[status].label}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle as="h2">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <MetaList className="sm:grid-cols-1">
                <MetaItem label="E-mail">
                  {customer.email ? (
                    <a href={`mailto:${customer.email}`} className="hover:underline">
                      {customer.email}
                    </a>
                  ) : (
                    '—'
                  )}
                </MetaItem>
                <MetaItem label="Phone">
                  {customer.phone ? (
                    <a href={`tel:${customer.phone}`} className="hover:underline">
                      {customer.phone}
                    </a>
                  ) : (
                    '—'
                  )}
                </MetaItem>
                <MetaItem label="Mobile">{customer.mobile ?? '—'}</MetaItem>
                <MetaItem label="Website">
                  {customer.website ? (
                    <a
                      href={customer.website}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="break-all hover:underline"
                    >
                      {customer.website}
                    </a>
                  ) : (
                    '—'
                  )}
                </MetaItem>
                {customer.vat_number ? (
                  <MetaItem label="VAT number">{customer.vat_number}</MetaItem>
                ) : null}
                {customer.registration_number ? (
                  <MetaItem label="Registration">{customer.registration_number}</MetaItem>
                ) : null}
              </MetaList>

              {customer.tags.length > 0 ? (
                <div className="border-t border-slate-200 pt-3">
                  <h3 className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                    Tags
                  </h3>
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {customer.tags.map((tag) => (
                      <Badge key={tag} tone="neutral">
                        {tag}
                      </Badge>
                    ))}
                  </span>
                </div>
              ) : null}

              <div className="border-t border-slate-200 pt-3">
                <h3 className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Billing address
                </h3>
                <address className="mt-1 text-sm not-italic text-slate-700">
                  {customer.address_line1 ? <span className="block">{customer.address_line1}</span> : null}
                  {customer.address_line2 ? <span className="block">{customer.address_line2}</span> : null}
                  {customer.postal_code || customer.city ? (
                    <span className="block">
                      {[customer.postal_code, customer.city].filter(Boolean).join(' ')}
                    </span>
                  ) : null}
                  {customer.country ? <span className="block">{customer.country}</span> : null}
                  {!customer.address_line1 && !customer.city ? (
                    <span className="text-slate-500">No address recorded.</span>
                  ) : null}
                </address>
              </div>

              {customer.notes ? (
                <div className="border-t border-slate-200 pt-3">
                  <h3 className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                    Notes
                  </h3>
                  <p className="mt-1 text-sm whitespace-pre-line text-slate-700">{customer.notes}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">
                Service addresses ({addresses.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CustomerAddressManager
                customerId={customer.id}
                addresses={addresses}
                canManage={canManage}
              />
            </CardContent>
          </Card>
        </div>

      </div>

    </PageContainer>
  );
}
