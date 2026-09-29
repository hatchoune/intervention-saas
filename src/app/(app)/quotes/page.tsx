import Link from 'next/link';
import type { Metadata } from 'next';
import { FileText, Plus } from 'lucide-react';

import { QuoteTable } from '@/components/quotes/quote-table';
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
  QUOTES_PER_PAGE,
  QUOTE_SORTS,
  listQuotes,
  type QuoteSort,
} from '@/lib/db/quotes';
import { can } from '@/lib/domain/permissions';
import { QUOTE_STATUSES, QUOTE_STATUS_META } from '@/lib/domain/status';
import { buildQueryString } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/format';
import type { QuoteStatus } from '@/types/database';

export const metadata: Metadata = { title: 'Quotes' };

type SearchParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function parseStatus(value: string): QuoteStatus | null {
  return (QUOTE_STATUSES as string[]).includes(value) ? (value as QuoteStatus) : null;
}

function parseSort(value: string): QuoteSort {
  return QUOTE_SORTS.find((option) => option.value === value)?.value ?? 'recent';
}

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireOrganization('/quotes');
  const params = await searchParams;

  const q = single(params.q).trim();
  const statusValue = single(params.status);
  const from = single(params.from);
  const to = single(params.to);
  const sort = parseSort(single(params.sort));
  const parsedPage = Number.parseInt(single(params.page), 10);
  const page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;

  const status = parseStatus(statusValue);
  const canManage = can('quotes.manage', session.role);
  const currency = session.organization.currency;

  const result = await listQuotes(session.organization.id, {
    q: q || null,
    status,
    from: from || null,
    to: to || null,
    sort,
    page,
    perPage: QUOTES_PER_PAGE,
  });

  const hasFilters = Boolean(q || status || from || to || sort !== 'recent');
  const { totals } = result;

  const buildHref = (nextPage: number): string =>
    `/quotes${buildQueryString({
      q,
      status: statusValue,
      from,
      to,
      sort: sort === 'recent' ? '' : sort,
      page: nextPage > 1 ? nextPage : '',
    })}`;

  return (
    <PageContainer>
      <PageHeader
        title="Quotes"
        description="Prepare, send and track quotes — accepted ones convert into invoices in one click."
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Quotes' }]}
        actions={
          canManage ? (
            <Link href="/quotes/new" className={buttonClasses('primary', 'md')}>
              <Plus aria-hidden className="size-4" />
              New quote
            </Link>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Awaiting reply"
          value={formatCurrency(totals.openAmount, currency)}
          hint={`${totals.openCount} draft or sent`}
          icon={<FileText aria-hidden className="size-4" />}
        />
        <StatCard
          label="Accepted"
          value={formatCurrency(totals.acceptedAmount, currency)}
          hint={`${totals.acceptedCount} signed`}
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
              placeholder="Quote number, notes or customer"
            />
          </Field>

          <Field htmlFor="filter-status" label="Status" className="min-w-[10rem]">
            <Select id="filter-status" name="status" defaultValue={statusValue}>
              <option value="">Any status</option>
              {QUOTE_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {QUOTE_STATUS_META[value].label}
                </option>
              ))}
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
              {QUOTE_SORTS.map((option) => (
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
          icon={<FileText aria-hidden className="size-5" />}
          title={hasFilters ? 'No quote matches these filters' : 'No quote yet'}
          description={
            hasFilters
              ? 'Try another search term or clear a filter.'
              : 'Create your first quote to send a priced proposal to a customer.'
          }
          action={
            hasFilters || !canManage ? null : (
              <Link href="/quotes/new" className={buttonClasses('primary', 'md')}>
                <Plus aria-hidden className="size-4" />
                New quote
              </Link>
            )
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <QuoteTable rows={result.rows} canManage={canManage} currency={currency} />
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
