import Link from 'next/link';
import { ClipboardList, Plus } from 'lucide-react';

import { InterventionTable } from '@/components/interventions/intervention-table';
import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/controls';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterForm, ResetFiltersButton } from '@/components/ui/filter-form';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { requireOrganization } from '@/lib/auth/session';
import {
  INTERVENTION_SORTS,
  INTERVENTIONS_PER_PAGE,
  isDayKey,
  listCustomerOptions,
  listInterventions,
  listTechnicianOptions,
  type InterventionSort,
} from '@/lib/db/interventions';
import { can } from '@/lib/domain/permissions';
import {
  INTERVENTION_PRIORITIES,
  INTERVENTION_PRIORITY_META,
  INTERVENTION_STATUSES,
  INTERVENTION_STATUS_META,
} from '@/lib/domain/status';
import { buildQueryString } from '@/lib/utils/cn';
import type { InterventionPriority, InterventionStatus } from '@/types/database';

type SearchParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function parseStatus(value: string): InterventionStatus | null {
  return INTERVENTION_STATUSES.find((status) => status === value) ?? null;
}

function parsePriority(value: string): InterventionPriority | null {
  return INTERVENTION_PRIORITIES.find((priority) => priority === value) ?? null;
}

function parseSort(value: string): InterventionSort {
  return INTERVENTION_SORTS.find((option) => option.value === value)?.value ?? 'recent';
}

export default async function InterventionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireOrganization('/interventions');
  const params = await searchParams;

  const q = single(params.q).trim();
  const statusValue = single(params.status);
  const priorityValue = single(params.priority);
  const technicianId = single(params.technicianId);
  const customerId = single(params.customerId);
  const from = single(params.from);
  const to = single(params.to);
  const sort = parseSort(single(params.sort));
  const parsedPage = Number.parseInt(single(params.page), 10);
  const page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;

  const status = parseStatus(statusValue);
  const priority = parsePriority(priorityValue);
  const canManage = can('interventions.manage', session.role);

  const [result, customers, technicians] = await Promise.all([
    listInterventions(session.organization.id, {
      q,
      status,
      priority,
      technicianId: technicianId || null,
      customerId: customerId || null,
      from: isDayKey(from) ? from : null,
      to: isDayKey(to) ? to : null,
      sort,
      page,
      perPage: INTERVENTIONS_PER_PAGE,
    }),
    listCustomerOptions(session.organization.id, { includeArchived: true }),
    listTechnicianOptions(session.organization.id, { includeInactive: true }),
  ]);

  const hasFilters = Boolean(
    q || status || priority || technicianId || customerId || from || to || sort !== 'recent',
  );

  const buildHref = (nextPage: number): string =>
    `/interventions${buildQueryString({
      q: q || undefined,
      status: status ?? undefined,
      priority: priority ?? undefined,
      technicianId: technicianId || undefined,
      customerId: customerId || undefined,
      from: isDayKey(from) ? from : undefined,
      to: isDayKey(to) ? to : undefined,
      sort: sort === 'recent' ? undefined : sort,
      page: nextPage > 1 ? nextPage : undefined,
    })}`;

  return (
    <PageContainer>
      <PageHeader
        title="Interventions"
        description="Every job order of the organisation, newest first."
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Interventions' }]}
        actions={
          canManage ? (
            <Link href="/interventions/new" className={buttonClasses('primary', 'md')}>
              <Plus aria-hidden className="size-4" />
              New intervention
            </Link>
          ) : null
        }
      />

      <Card className="p-4">
        <FilterForm>
          <Field htmlFor="filter-q" label="Search" className="min-w-[12rem] flex-1">
            <Input
              id="filter-q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Reference, title, description or customer"
            />
          </Field>

          <Field htmlFor="filter-status" label="Status" className="min-w-[9rem]">
            <Select id="filter-status" name="status" defaultValue={status ?? ''}>
              <option value="">Any status</option>
              {INTERVENTION_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {INTERVENTION_STATUS_META[value].label}
                </option>
              ))}
            </Select>
          </Field>

          <Field htmlFor="filter-priority" label="Priority" className="min-w-[9rem]">
            <Select id="filter-priority" name="priority" defaultValue={priority ?? ''}>
              <option value="">Any priority</option>
              {INTERVENTION_PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {INTERVENTION_PRIORITY_META[value].label}
                </option>
              ))}
            </Select>
          </Field>

          <Field htmlFor="filter-technician" label="Technician" className="min-w-[11rem]">
            <Select id="filter-technician" name="technicianId" defaultValue={technicianId}>
              <option value="">Any technician</option>
              {technicians.map((technician) => (
                <option key={technician.id} value={technician.id}>
                  {technician.full_name}
                </option>
              ))}
            </Select>
          </Field>

          <Field htmlFor="filter-customer" label="Customer" className="min-w-[11rem]">
            <Select id="filter-customer" name="customerId" defaultValue={customerId}>
              <option value="">Any customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field htmlFor="filter-from" label="Scheduled from" className="min-w-[9rem]">
            <Input id="filter-from" name="from" type="date" defaultValue={isDayKey(from) ? from : ''} />
          </Field>

          <Field htmlFor="filter-to" label="Scheduled to" className="min-w-[9rem]">
            <Input id="filter-to" name="to" type="date" defaultValue={isDayKey(to) ? to : ''} />
          </Field>

          <Field htmlFor="filter-sort" label="Sort" className="min-w-[10rem]">
            <Select id="filter-sort" name="sort" defaultValue={sort}>
              {INTERVENTION_SORTS.map((option) => (
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
          icon={<ClipboardList aria-hidden className="size-5" />}
          title={hasFilters ? 'No intervention matches these filters' : 'No intervention yet'}
          description={
            hasFilters
              ? 'Try widening the date range or clearing a filter.'
              : 'Create the first job order to plan a technician and track the work.'
          }
          action={
            hasFilters ? null : canManage ? (
              <Link href="/interventions/new" className={buttonClasses('primary', 'md')}>
                <Plus aria-hidden className="size-4" />
                New intervention
              </Link>
            ) : null
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <InterventionTable rows={result.rows} canManage={canManage} />
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
