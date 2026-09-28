import { Badge } from '@/components/ui/badge';
import { INTERVENTION_PRIORITY_META, INTERVENTION_STATUS_META } from '@/lib/domain/status';
import type { InterventionPriority, InterventionStatus } from '@/types/database';

/**
 * Status / priority badges.
 *
 * Colour is never the only signal: every badge renders the label text, so the
 * information survives colour-blindness and greyscale printing.
 */

export function InterventionStatusBadge({
  status,
  className,
}: {
  status: InterventionStatus;
  className?: string;
}) {
  const meta = INTERVENTION_STATUS_META[status];

  return (
    <Badge tone={meta.tone} className={className} title={meta.description}>
      {meta.label}
    </Badge>
  );
}

export function InterventionPriorityBadge({
  priority,
  withLabel = true,
  className,
}: {
  priority: InterventionPriority;
  /** Appends the word "priority" so the badge is self-describing. */
  withLabel?: boolean;
  className?: string;
}) {
  const meta = INTERVENTION_PRIORITY_META[priority];

  return (
    <Badge tone={meta.tone} className={className} title={meta.description}>
      {meta.label}
      {withLabel ? ' priority' : ''}
    </Badge>
  );
}
