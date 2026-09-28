import { History } from 'lucide-react';

import { StatusDot } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import type { ActivityLogRow, InterventionRow } from '@/types/database';
import type { BadgeTone } from '@/lib/domain/status';
import { formatDateTime, formatRelative } from '@/lib/utils/format';

/**
 * Chronological history of an intervention: the lifecycle timestamps owned by
 * the database triggers plus the `activity_log` entries of this record.
 */

interface TimelineEvent {
  id: string;
  at: string;
  title: string;
  description?: string;
  actor: string | null;
  tone: BadgeTone;
}

const ACTION_TONE: Record<ActivityLogRow['action'], BadgeTone> = {
  created: 'info',
  updated: 'neutral',
  deleted: 'danger',
  status_changed: 'accent',
};

export interface InterventionTimelineProps {
  intervention: InterventionRow;
  activity: ActivityLogRow[];
}

export function InterventionTimeline({ intervention, activity }: InterventionTimelineProps) {
  const events: TimelineEvent[] = activity.map((entry) => ({
    id: `log-${entry.id}`,
    at: entry.created_at,
    title: entry.summary,
    actor: entry.actor_name,
    tone: ACTION_TONE[entry.action],
  }));

  const loggedActions = new Set(activity.map((entry) => entry.action));

  // Lifecycle timestamps are owned by the database triggers, so surface them
  // even when the change did not go through an action (SQL, imports…).
  const lifecycle: TimelineEvent[] = [];

  if (!loggedActions.has('created')) {
    lifecycle.push({
      id: 'lifecycle-created',
      at: intervention.created_at,
      title: 'Intervention created',
      actor: null,
      tone: 'info',
    });
  }

  if (intervention.completed_at) {
    lifecycle.push({
      id: 'lifecycle-completed',
      at: intervention.completed_at,
      title: 'Work completed',
      description: intervention.completion_notes ?? undefined,
      actor: null,
      tone: 'success',
    });
  }

  if (intervention.cancelled_at) {
    lifecycle.push({
      id: 'lifecycle-cancelled',
      at: intervention.cancelled_at,
      title: 'Intervention cancelled',
      actor: null,
      tone: 'danger',
    });
  }

  if (
    intervention.updated_at &&
    intervention.updated_at !== intervention.created_at &&
    !loggedActions.has('updated')
  ) {
    lifecycle.push({
      id: 'lifecycle-updated',
      at: intervention.updated_at,
      title: 'Record updated',
      actor: null,
      tone: 'neutral',
    });
  }

  const timeline = [...events, ...lifecycle].sort((left, right) =>
    right.at.localeCompare(left.at),
  );

  if (timeline.length === 0) {
    return (
      <EmptyState
        icon={<History aria-hidden className="size-5" />}
        title="No history yet"
        description="Changes made to this intervention are recorded here."
      />
    );
  }

  return (
    <ol className="space-y-4">
      {timeline.map((event) => (
        <li key={event.id} className="relative flex gap-3 pl-1">
          <span className="mt-1.5 flex flex-col items-center">
            <StatusDot tone={event.tone} className="mt-1.5" />
          </span>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-sm font-medium text-slate-800">{event.title}</p>
            <p className="text-xs text-slate-500">
              <time dateTime={event.at}>{formatDateTime(event.at)}</time>
              {' · '}
              {formatRelative(event.at)}
              {event.actor ? ` · ${event.actor}` : ''}
            </p>
            {event.description ? (
              <p className="rounded-md bg-slate-50 px-2 py-1 text-xs whitespace-pre-wrap text-slate-600">
                {event.description}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
