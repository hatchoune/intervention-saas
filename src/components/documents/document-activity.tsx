import { formatDateTime } from '@/lib/utils/format';
import type { ActivityAction, ActivityLogRow } from '@/types/database';

/** Audit trail shared by the quote and invoice detail pages. */

const ACTION_LABELS: Record<ActivityAction, string> = {
  created: 'Created',
  updated: 'Updated',
  deleted: 'Deleted',
  status_changed: 'Status changed',
};

export function DocumentActivity({ rows }: { rows: ActivityLogRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No activity recorded yet.</p>;
  }

  return (
    <ol className="divide-y divide-slate-100">
      {rows.map((row) => (
        <li key={row.id} className="flex items-start justify-between gap-4 py-2.5">
          <div className="min-w-0">
            <p className="text-sm text-slate-800">{row.summary}</p>
            <p className="text-xs text-slate-500">
              {row.actor_name ?? 'System'} · {ACTION_LABELS[row.action] ?? row.action}
            </p>
          </div>
          <time
            dateTime={row.created_at}
            className="shrink-0 text-xs whitespace-nowrap text-slate-400"
          >
            {formatDateTime(row.created_at)}
          </time>
        </li>
      ))}
    </ol>
  );
}
