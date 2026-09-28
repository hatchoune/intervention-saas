import { Avatar } from '@/components/ui/data-display';
import { InterventionCard } from '@/components/planning/intervention-card';
import type { TechnicianLane as TechnicianLaneData } from '@/lib/db/planning';
import { cn } from '@/lib/utils/cn';

/** One technician column of the day board, including empty lanes. */
export function TechnicianLane({
  lane,
  className,
}: {
  lane: TechnicianLaneData;
  className?: string;
}) {
  const load = lane.entries.length;

  return (
    <section
      aria-label={`${lane.technician.full_name}: ${load} intervention${load === 1 ? '' : 's'}`}
      className={cn('space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3', className)}
    >
      <header className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <Avatar name={lane.technician.full_name} color={lane.technician.color} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-900">
              {lane.technician.full_name}
            </span>
            <span className="block text-[11px] text-slate-500">
              {lane.technician.is_active ? 'Active' : 'Inactive'}
            </span>
          </span>
        </span>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
            load === 0 ? 'bg-slate-200 text-slate-600' : 'bg-indigo-100 text-indigo-700',
          )}
        >
          {load} job{load === 1 ? '' : 's'}
        </span>
      </header>

      {load === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500">
          No work scheduled
        </p>
      ) : (
        <ul className="space-y-2">
          {lane.entries.map((entry) => (
            <li key={entry.intervention.id}>
              <InterventionCard entry={entry} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
