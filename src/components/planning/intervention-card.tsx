import Link from 'next/link';
import { MapPin } from 'lucide-react';

import { InterventionPriorityBadge, InterventionStatusBadge } from '@/components/interventions/badges';
import { Avatar } from '@/components/ui/data-display';
import { INTERVENTION_STATUS_META, type BadgeTone } from '@/lib/domain/status';
import type { PlanningEntry } from '@/lib/db/planning';
import { cn } from '@/lib/utils/cn';
import { formatTime } from '@/lib/utils/format';

/**
 * Compact intervention card used by every planning view.
 *
 * The colour rail is decorative — the status is always spelled out in the
 * badge, so colour is never the only signal.
 */

const RAILS: Record<BadgeTone, string> = {
  neutral: 'bg-slate-300',
  info: 'bg-sky-400',
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  danger: 'bg-rose-400',
  accent: 'bg-indigo-400',
};

function timeWindow(entry: PlanningEntry): string {
  const { scheduled_start: start, scheduled_end: end } = entry.intervention;
  if (!start) return 'Unscheduled';
  return `${formatTime(start)}${end ? `–${formatTime(end)}` : ''}`;
}

export interface InterventionCardProps {
  entry: PlanningEntry;
  /** Shown in the week / upcoming views where the lane is not per technician. */
  showTechnician?: boolean;
  className?: string;
}

export function InterventionCard({ entry, showTechnician = false, className }: InterventionCardProps) {
  const { intervention, customer, technician } = entry;
  const statusMeta = INTERVENTION_STATUS_META[intervention.status];
  const city = intervention.city ?? customer?.city ?? null;

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-lg border border-slate-200 bg-white p-2.5 pl-3.5 shadow-sm transition-colors hover:border-indigo-200',
        className,
      )}
    >
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', RAILS[statusMeta.tone])} />

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-500 tabular-nums">{timeWindow(entry)}</span>
        <InterventionStatusBadge status={intervention.status} />
      </div>

      <h3 className="mt-1 text-sm font-medium text-slate-900">
        <Link href={`/interventions/${intervention.id}`} className="hover:text-indigo-700 hover:underline">
          {intervention.title}
        </Link>
      </h3>

      <p className="mt-0.5 text-xs text-slate-600">
        {customer ? customer.name : 'Customer unavailable'}
        {city ? (
          <span className="inline-flex items-center gap-1 text-slate-500">
            {' · '}
            <MapPin aria-hidden className="size-3" />
            {city}
          </span>
        ) : null}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-slate-500">{intervention.reference}</span>
        {intervention.priority === 'urgent' || intervention.priority === 'high' ? (
          <InterventionPriorityBadge priority={intervention.priority} withLabel={false} />
        ) : null}
        {showTechnician ? (
          technician ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
              <Avatar name={technician.full_name} color={technician.color} size="sm" />
              {technician.full_name}
            </span>
          ) : (
            <span className="text-[11px] font-medium text-amber-700">Unassigned</span>
          )
        ) : null}
      </div>
    </article>
  );
}
