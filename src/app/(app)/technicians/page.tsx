import Link from 'next/link';
import { HardHat, Plus } from 'lucide-react';

import { TechnicianTable } from '@/components/technicians/technician-table';
import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/controls';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterForm, ResetFiltersButton } from '@/components/ui/filter-form';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { requireOrganization } from '@/lib/auth/session';
import {
  TECHNICIAN_SORTS,
  TECHNICIANS_PER_PAGE,
  listTechnicians,
  type TechnicianSort,
} from '@/lib/db/technicians';
import { can } from '@/lib/domain/permissions';
import { TECHNICIAN_STATUSES, TECHNICIAN_STATUS_META } from '@/lib/domain/status';
import { buildQueryString } from '@/lib/utils/cn';
import type { TechnicianStatus } from '@/types/database';

type SearchParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function parseStatus(value: string): TechnicianStatus | null {
  return TECHNICIAN_STATUSES.find((status) => status === value) ?? null;
}

function parseSort(value: string): TechnicianSort {
  return TECHNICIAN_SORTS.find((option) => option.value === value)?.value ?? 'name';
}

/** `all` | `active` | `inactive` — maps onto the `is_active` filter. */
function parseActive(value: string): boolean | null {
  if (value === 'active') return true;
  if (value === 'inactive') return false;
  return null;
}

export default async function TechniciansPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireOrganization('/technicians');
  const params = await searchParams;

  const q = single(params.q).trim();
  const statusValue = single(params.status);
  const activeValue = single(params.active) || 'active';
  const linkedValue = single(params.linked);
  const sort = parseSort(single(params.sort));
  const parsedPage = Number.parseInt(single(params.page), 10);
  const page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;

  const status = parseStatus(statusValue);
  const activeOnly = parseActive(activeValue);
  const linked = linkedValue === 'yes' ? true : linkedValue === 'no' ? false : null;
  const canManage = can('technicians.manage', session.role);

  const result = await listTechnicians(session.organization.id, {
    q,
    status,
    activeOnly,
    linked,
    sort,
    page,
    perPage: TECHNICIANS_PER_PAGE,
  });

  const hasFilters = Boolean(q || status || activeValue !== 'active' || linked || sort !== 'name');

  const buildHref = (nextPage: number): string =>
    `/technicians${buildQueryString({
      q,
      status: statusValue,
      active: activeValue === 'active' ? '' : activeValue,
      linked: linkedValue,
      sort: sort === 'name' ? '' : sort,
      page: nextPage > 1 ? nextPage : '',
    })}`;

  return (
    <PageContainer>
      <PageHeader
        title="Technicians"
        description="Your field team, their availability and how much work is on their plate."
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Technicians' }]}
        actions={
          canManage ? (
            <Link href="/technicians/new" className={buttonClasses('primary', 'md')}>
              <Plus aria-hidden className="size-4" />
              New technician
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
              placeholder="Name, e-mail or job title"
            />
          </Field>

          <Field htmlFor="filter-status" label="Availability" className="min-w-[10rem]">
            <Select id="filter-status" name="status" defaultValue={status ?? ''}>
              <option value="">Any availability</option>
              {TECHNICIAN_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {TECHNICIAN_STATUS_META[value].label}
                </option>
              ))}
            </Select>
          </Field>

          <Field htmlFor="filter-active" label="Team status" className="min-w-[9rem]">
            <Select id="filter-active" name="active" defaultValue={activeValue}>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
              <option value="all">Everyone</option>
            </Select>
          </Field>

          <Field htmlFor="filter-linked" label="Login" className="min-w-[9rem]">
            <Select id="filter-linked" name="linked" defaultValue={linkedValue}>
              <option value="">Any</option>
              <option value="yes">Linked</option>
              <option value="no">Not linked</option>
            </Select>
          </Field>

          <Field htmlFor="filter-sort" label="Sort" className="min-w-[10rem]">
            <Select id="filter-sort" name="sort" defaultValue={sort}>
              {TECHNICIAN_SORTS.map((option) => (
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
          icon={<HardHat aria-hidden className="size-5" />}
          title={hasFilters ? 'No technician matches these filters' : 'No technician yet'}
          description={
            hasFilters
              ? 'Try clearing a filter or searching for another name.'
              : 'Add your first technician to start scheduling interventions.'
          }
          action={
            hasFilters || !canManage ? null : (
              <Link href="/technicians/new" className={buttonClasses('primary', 'md')}>
                <Plus aria-hidden className="size-4" />
                New technician
              </Link>
            )
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <TechnicianTable
            rows={result.rows}
            canManage={canManage}
            currentUserId={session.user.id}
          />
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
