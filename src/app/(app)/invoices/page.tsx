import Link from 'next/link';
import type { Metadata } from 'next';
import { Plus, Receipt } from 'lucide-react';

import { InvoiceTable } from '@/components/invoices/invoice-table';
import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/controls';
import { StatCard } from '@/components/ui/data-display';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterForm, ResetFiltersButton } from '@/components/ui/filter-form';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { requireOrganization } from '@/lib/auth/session';
import {
  INVOICES_PER_PAGE,
  INVOICE_SORTS,
  listInvoices,
  type InvoiceSort,
} from '@/lib/db/invoices';
import { can } from '@/lib/domain/permissions';
import { INVOICE_STATUSES, INVOICE_STATUS_META } from '@/lib/domain/status';
import { buildQueryString } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/format';
import type { InvoiceStatus } from '@/types/database';

export const metadata: Metadata = { title: 'Invoices' };

type SearchParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function parseStatus(value: string): InvoiceStatus | null {
  return (INVOICE_STATUSES as string[]).includes(value) ? (value as InvoiceStatus) : null;
}

function parseSort(value: string): InvoiceSort {
  return INVOICE_SORTS.find((option) => option.value === value)?.value ?? 'recent';
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireOrganization('/invoices');
  const params = await searchParams;

  const q = single(params.q).trim();
  const statusValue = single(params.status);
  const from = single(params.from);
  const to = single(params.to);
  const sort = parseSort(single(params.sort));
  const onlyUnpaid = single(params.unpaid) === '1';
  const parsedPage = Number.parseInt(single(params.page), 10);
  const page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;

  const status = parseStatus(statusValue);
  const canManage = can('invoices.manage', session.role);
  const currency = session.organization.currency;

  const result = await listInvoices(session.organization.id, {
    q: q || null,
    status,
    from: from || null,
    to: to || null,
    onlyUnpaid: onlyUnpaid || null,
    sort,
    page,
    perPage: INVOICES_PER_PAGE,
  });

  const hasFilters = Boolean(q || status || from || to || onlyUnpaid || sort !== 'recent');
  const { summary } = result;

  const buildHref = (nextPage: number): string =>
    `/invoices${buildQueryString({
      q,
      status: statusValue,
      from,
      to,
      unpaid: onlyUnpaid ? '1' : '',
      sort: sort === 'recent' ? '' : sort,
      page: nextPage > 1 ? nextPage : '',
    })}`;

  return (
    <PageContainer>
      <PageHeader
        title="Invoices"
        description="Issue invoices, record payments and keep an eye on what is still owed."
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Invoices' }]}
        actions={
          canManage ? (
            <Link href="/invoices/new" className={buttonClasses('primary', 'md')}>
              <Plus aria-hidden className="size-4" />
              New invoice
            </Link>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Outstanding"
          value={formatCurrency(summary.unpaidAmount, currency)}
          hint={`${summary.unpaidCount} invoices`}
          icon={<Receipt aria-hidden className="size-4" />}
        />
        <StatCard
          label="Overdue"
          value={formatCurrency(summary.overdueAmount, currency)}
          hint={`${summary.overdueCount} past due`}
          tone={summary.overdueCount > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Paid this month"
          value={formatCurrency(summary.paidThisMonth, currency)}
          hint="Issued this month"
          tone="accent"
        />
      </div>
      <Card>
        <FilterForm className="p-4">
          <Field htmlFor="filter-q" label="Search" className="min-w-[14rem] flex-1">
            <Input
              id="filter-q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Invoice number, notes or customer"
            />
          </Field>

          <Field htmlFor="filter-status" label="Status" className="min-w-[10rem]">
            <Select id="filter-status" name="status" defaultValue={statusValue}>
              <option value="">Any status</option>
              {INVOICE_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {INVOICE_STATUS_META[value].label}
                </option>
              ))}
            </Select>
          </Field>

          <Field htmlFor="filter-unpaid" label="Balance" className="min-w-[10rem]">
            <Select id="filter-unpaid" name="unpaid" defaultValue={onlyUnpaid ? '1' : ''}>
              <option value="">All invoices</option>
              <option value="1">With a balance only</option>
            </Select>
          </Field>

          <Field htmlFor="filter-from" label="Issued from" className="min-w-[9rem]">
            <Input id="filter-from" name="from" type="date" defaultValue={from} />
          </Field>

          <Field htmlFor="filter-to" label="Issued to" className="min-w-[9rem]">
            <Input id="filter-to" name="to" type="date" defaultValue={to} />
          </Field>

          <Field htmlFor="filter-sort" label="Sort" className="min-w-[10rem]">
            <Select id="filter-sort" name="sort" defaultValue={sort}>
              {INVOICE_SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <ResetFiltersButton />
        </FilterForm>
      </Card>

      {result.total === 0 ? (
        <EmptyState
          icon={<Receipt aria-hidden className="size-5" />}
          title={hasFilters ? 'No invoice matches these filters' : 'No invoice yet'}
          description={
            hasFilters
              ? 'Try another search term or clear a filter.'
              : 'Create an invoice manually or generate one from a completed intervention.'
          }
          action={
            hasFilters || !canManage ? null : (
              <Link href="/invoices/new" className={buttonClasses('primary', 'md')}>
                <Plus aria-hidden className="size-4" />
                New invoice
              </Link>
            )
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <InvoiceTable rows={result.rows} canManage={canManage} currency={currency} />
          <Pagination
            page={result.page}
            perPage={result.perPage}
            total={result.total}
            buildHref={buildHref}
          />
        </Card>
      )}
    </PageContainer>
  );
}
