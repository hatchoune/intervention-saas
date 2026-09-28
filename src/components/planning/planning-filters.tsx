import { Field, Select } from '@/components/ui/controls';
import { FilterForm, ResetFiltersButton } from '@/components/ui/filter-form';
import type { TechnicianOption } from '@/lib/db/interventions';
import { INTERVENTION_STATUSES, INTERVENTION_STATUS_META } from '@/lib/domain/status';

/** Shared filter bar for the planning views (GET form, works without JS). */

export interface PlanningFiltersProps {
  action: string;
  technicians: TechnicianOption[];
  values: { technicianId?: string; status?: string; days?: string };
  includeStatus?: boolean;
  /** Renders the 7 / 30 / 90 day horizon selector. */
  includeDays?: boolean;
  /** Query params that must survive the submit (date, start…). */
  hidden?: Record<string, string | undefined>;
  className?: string;
}

export function PlanningFilters({
  action,
  technicians,
  values,
  includeStatus = false,
  includeDays = false,
  hidden = {},
  className,
}: PlanningFiltersProps) {
  return (
    <FilterForm action={action} className={className}>
      {Object.entries(hidden).map(([key, value]) =>
        value ? <input key={key} type="hidden" name={key} value={value} /> : null,
      )}

      <Field htmlFor="planning-technician" label="Technician" className="min-w-[11rem]">
        <Select id="planning-technician" name="technicianId" defaultValue={values.technicianId ?? ''}>
          <option value="">All technicians</option>
          {technicians.map((technician) => (
            <option key={technician.id} value={technician.id}>
              {technician.full_name}
            </option>
          ))}
        </Select>
      </Field>

      {includeStatus ? (
        <Field htmlFor="planning-status" label="Status" className="min-w-[9rem]">
          <Select id="planning-status" name="status" defaultValue={values.status ?? ''}>
            <option value="">Any status</option>
            {INTERVENTION_STATUSES.filter((status) => status !== 'cancelled').map((status) => (
              <option key={status} value={status}>
                {INTERVENTION_STATUS_META[status].label}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {includeDays ? (
        <Field htmlFor="planning-days" label="Horizon" className="min-w-[9rem]">
          <Select id="planning-days" name="days" defaultValue={values.days ?? '30'}>
            <option value="7">Next 7 days</option>
            <option value="30">Next 30 days</option>
            <option value="90">Next 90 days</option>
          </Select>
        </Field>
      ) : null}

      <ResetFiltersButton />
    </FilterForm>
  );
}
