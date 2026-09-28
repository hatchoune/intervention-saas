import { StatusDot } from '@/components/ui/badge';
import { INTERVENTION_STATUS_META, INTERVENTION_STATUSES } from '@/lib/domain/status';

/** Status legend: dot + label + meaning, so colour is never the only cue. */
export function PlanningLegend() {
  return (
    <section aria-label="Status legend" className="space-y-2">
      <h2 className="text-xs font-medium tracking-wide text-slate-500 uppercase">Legend</h2>
      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {INTERVENTION_STATUSES.map((status) => {
          const meta = INTERVENTION_STATUS_META[status];
          return (
            <li key={status} className="flex items-center gap-2 text-xs text-slate-600">
              <StatusDot tone={meta.tone} />
              <span className="font-medium text-slate-800">{meta.label}</span>
              <span className="text-slate-500">{meta.description}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
