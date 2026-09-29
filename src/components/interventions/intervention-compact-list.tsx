import Link from 'next/link';

import {
  InterventionPriorityBadge,
  InterventionStatusBadge,
} from '@/components/interventions/badges';
import { cn } from '@/lib/utils/cn';
import { formatDate, formatTime } from '@/lib/utils/format';
import type { InterventionRow } from '@/types/database';

/**
 * Compact, reusable intervention list used by the customer and technician detail
 * pages: reference, title, schedule, status and priority — the same shape as the
 * planning cards but without the drag affordances.
 */
export function InterventionCompactList({
  rows,
  emptyLabel,
  className,
}: {
  rows: InterventionRow[];
  emptyLabel: string;
  className?: string;
}) {
  if (rows.length === 0) {
    return <p className={cn('text-sm text-slate-500', className)}>{emptyLabel}</p>;
  }

  return (
    <ul className={cn('divide-y divide-slate-100', className)}>
      {rows.map((row) => (
        <li key={row.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
          <div className="min-w-0 space-y-0.5">
            <p className="flex items-center gap-2 text-sm">
              <Link
                href={`/interventions/${row.id}`}
                className="font-medium text-indigo-700 hover:underline"
              >
                {row.title}
              </Link>
              <span className="font-mono text-xs text-slate-400">{row.reference}</span>
            </p>
            <p className="text-xs text-slate-500">
              {row.scheduled_start ? (
                <>
                  {formatDate(row.scheduled_start)} · {formatTime(row.scheduled_start)}
                  {row.scheduled_end ? `–${formatTime(row.scheduled_end)}` : ''}
                </>
              ) : (
                'Not scheduled'
              )}
              {row.city ? ` · ${row.city}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <InterventionPriorityBadge priority={row.priority} withLabel={false} />
            <InterventionStatusBadge status={row.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}
