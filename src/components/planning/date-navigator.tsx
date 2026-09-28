import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { buttonClasses } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/controls';
import { buildQueryString, cn } from '@/lib/utils/cn';
import { formatDate, formatDayLabel, toDateInputValue } from '@/lib/utils/format';

/**
 * Server-rendered date navigators for the planning views: previous / next /
 * today are plain links, and the jump-to-date control is a native GET form, so
 * everything works without JavaScript.
 */

type ExtraParams = Record<string, string | undefined>;

function dayKey(value: Date): string {
  return toDateInputValue(value);
}

function shiftDay(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00`);
  parsed.setDate(parsed.getDate() + days);
  return dayKey(parsed);
}

function href(basePath: string, params: ExtraParams, key: string, value: string | undefined): string {
  return `${basePath}${buildQueryString({ ...params, [key]: value })}`;
}

function NavLink({
  to,
  label,
  direction,
}: {
  to: string;
  label: string;
  direction: 'previous' | 'next';
}) {
  return (
    <Link href={to} className={buttonClasses('outline', 'sm')} aria-label={label} rel={direction}>
      {direction === 'previous' ? (
        <ChevronLeft aria-hidden className="size-4" />
      ) : (
        <ChevronRight aria-hidden className="size-4" />
      )}
      <span className="hidden sm:inline">{direction === 'previous' ? 'Previous' : 'Next'}</span>
    </Link>
  );
}

function JumpForm({
  basePath,
  fieldName,
  value,
  label,
  params,
  className,
}: {
  basePath: string;
  fieldName: string;
  value: string;
  label: string;
  params: ExtraParams;
  className?: string;
}) {
  return (
    <form
      method="get"
      action={basePath}
      className={cn('flex flex-wrap items-end gap-2 print-hidden', className)}
    >
      {Object.entries(params).map(([key, paramValue]) =>
        paramValue ? <input key={key} type="hidden" name={key} value={paramValue} /> : null,
      )}
      <Field htmlFor={`planning-${fieldName}`} label={label}>
        <Input
          id={`planning-${fieldName}`}
          name={fieldName}
          type="date"
          defaultValue={value}
          className="w-[10.5rem]"
        />
      </Field>
      <button type="submit" className={buttonClasses('outline', 'md')}>
        Go
      </button>
    </form>
  );
}

export interface DayStripProps {
  date: string;
  basePath: string;
  params?: ExtraParams;
}

/** Date navigation for the day view (`?date=yyyy-MM-dd`). */
export function DayStrip({ date, basePath, params = {} }: DayStripProps) {
  const today = dayKey(new Date());

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-900">{formatDayLabel(date)}</p>
        <p className="text-xs text-slate-500">
          {date === today ? 'Today' : date < today ? 'Past day' : 'Upcoming day'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <NavLink
          to={href(basePath, params, 'date', shiftDay(date, -1))}
          label="Previous day"
          direction="previous"
        />
        <Link href={href(basePath, params, 'date', today)} className={buttonClasses('secondary', 'sm')}>
          Today
        </Link>
        <NavLink
          to={href(basePath, params, 'date', shiftDay(date, 1))}
          label="Next day"
          direction="next"
        />
        <JumpForm
          basePath={basePath}
          fieldName="date"
          value={date}
          label="Jump to a day"
          params={params}
        />
      </div>
    </div>
  );
}

export interface WeekStripProps {
  start: string;
  basePath: string;
  params?: ExtraParams;
}

/** Date navigation for the week view (`?start=yyyy-MM-dd`, Monday). */
export function WeekStrip({ start, basePath, params = {} }: WeekStripProps) {
  const end = shiftDay(start, 6);
  const thisMonday = shiftDay(dayKey(new Date()), -((new Date().getDay() + 6) % 7));

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-900">
          Week of {formatDate(start, 'dd/MM/yyyy')} – {formatDate(end, 'dd/MM/yyyy')}
        </p>
        <p className="text-xs text-slate-500">Monday to Sunday</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <NavLink
          to={href(basePath, params, 'start', shiftDay(start, -7))}
          label="Previous week"
          direction="previous"
        />
        <Link
          href={href(basePath, params, 'start', thisMonday)}
          className={buttonClasses('secondary', 'sm')}
        >
          This week
        </Link>
        <NavLink
          to={href(basePath, params, 'start', shiftDay(start, 7))}
          label="Next week"
          direction="next"
        />
        <JumpForm
          basePath={basePath}
          fieldName="start"
          value={start}
          label="Jump to a week"
          params={params}
        />
      </div>
    </div>
  );
}
