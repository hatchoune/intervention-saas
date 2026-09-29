import Link from 'next/link';
import type { Metadata } from 'next';
import { Plus, Users } from 'lucide-react';

import { CustomerTable } from '@/components/customers/customer-table';
import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/controls';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterForm, ResetFiltersButton } from '@/components/ui/filter-form';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { requireOrganization } from '@/lib/auth/session';
import {
  CUSTOMER_SORTS,
  CUSTOMERS_PER_PAGE,
  listCustomers,
  type CustomerSort,
} from '@/lib/db/customers';
import { can } from '@/lib/domain/permissions';
import { CUSTOMER_STATUS_META, CUSTOMER_TYPE_META } from '@/lib/domain/status';
import { buildQueryString } from '@/lib/utils/cn';
import type { CustomerStatus, CustomerType } from '@/types/database';

export const metadata: Metadata = { title: 'Customers' };

type SearchParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function parseType(value: string): CustomerType | null {
  return value === 'individual' || value === 'company' ? value : null;
}

function parseStatus(value: string): CustomerStatus | null {
  return value === 'active' || value === 'archived' ? value : null;
}

function parseSort(value: string): CustomerSort {
  return CUSTOMER_SORTS.find((option) => option.value === value)?.value ?? 'name';
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireOrganization('/customers');
  const params = await searchParams;

  const q = single(params.q).trim();
  const typeValue = single(params.type);
  const statusValue = single(params.status);
  const sort = parseSort(single(params.sort));
  const parsedPage = Number.parseInt(single(params.page), 10);
  const page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;

  const type = parseType(typeValue);
  const status = parseStatus(statusValue);
  const canManage = can('customers.manage', session.role);

  const result = await listCustomers({
    organizationId: session.organization.id,
    q,
    type,
    status,
    sort,
    page,
    perPage: CUSTOMERS_PER_PAGE,
  });

  const hasFilters = Boolean(q || type || status || sort !== 'name');

  const buildHref = (nextPage: number): string =>
    `/customers${buildQueryString({
      q,
      type: typeValue,
      status: statusValue,
      sort: sort === 'name' ? '' : sort,
      page: nextPage > 1 ? nextPage : '',
    })}`;

  return (
    <PageContainer>
      <PageHeader
        title="Customers"
        description="Everyone you work for: individuals, companies, their sites and their history."
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Customers' }]}
        actions={
          canManage ? (
            <Link href="/customers/new" className={buttonClasses('primary', 'md')}>
              <Plus aria-hidden className="size-4" />
              New customer
            </Link>
          ) : null
        }
      />

      <Card>
        <FilterForm className="p-4">
          <Field htmlFor="filter-q" label="Search" className="min-w-[14rem] flex-1">
            <Input
              id="filter-q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Name, e-mail or city"
            />
          </Field>

          <Field htmlFor="filter-type" label="Type" className="min-w-[10rem]">
            <Select id="filter-type" name="type" defaultValue={typeValue}>
              <option value="">Any type</option>
              <option value="individual">{CUSTOMER_TYPE_META.individual.label}</option>
              <option value="company">{CUSTOMER_TYPE_META.company.label}</option>
            </Select>
          </Field>

          <Field htmlFor="filter-status" label="Status" className="min-w-[10rem]">
            <Select id="filter-status" name="status" defaultValue={statusValue}>
              <option value="">Any status</option>
              <option value="active">{CUSTOMER_STATUS_META.active.label}</option>
              <option value="archived">{CUSTOMER_STATUS_META.archived.label}</option>
            </Select>
          </Field>

          <Field htmlFor="filter-sort" label="Sort" className="min-w-[10rem]">
            <Select id="filter-sort" name="sort" defaultValue={sort}>
              {CUSTOMER_SORTS.map((option) => (
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
          icon={<Users aria-hidden className="size-5" />}
          title={hasFilters ? 'No customer matches these filters' : 'No customer yet'}
          description={
            hasFilters
              ? 'Try another search term or clear a filter.'
              : 'Create your first customer to schedule an intervention for them.'
          }
          action={
            hasFilters || !canManage ? null : (
              <Link href="/customers/new" className={buttonClasses('primary', 'md')}>
                <Plus aria-hidden className="size-4" />
                New customer
              </Link>
            )
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <CustomerTable rows={result.rows} canManage={canManage} />
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
