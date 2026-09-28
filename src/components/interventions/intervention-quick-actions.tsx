'use client';

import { useActionState, useState } from 'react';
import { Trash2, UserCog } from 'lucide-react';

import { ActionAlert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Select, Textarea } from '@/components/ui/controls';
import { SubmitButton } from '@/components/ui/submit-button';
import {
  assignInterventionTechnicianAction,
  changeInterventionStatusAction,
  deleteInterventionAction,
} from '@/lib/actions/interventions';
import type { TechnicianOption } from '@/lib/db/interventions';
import { INTERVENTION_STATUS_META } from '@/lib/domain/status';
import { IDLE_ACTION_STATE } from '@/lib/errors';
import type { InterventionStatus } from '@/types/database';

/**
 * Detail-page quick actions: legal status transitions, reassignment and
 * deletion. Every form is a Server Action; the database re-checks the
 * permissions, so hiding a control is a UX nicety, never the security gate.
 */

export interface InterventionQuickActionsProps {
  interventionId: string;
  currentStatus: InterventionStatus;
  /** Legal next statuses (the current one is excluded). */
  transitions: InterventionStatus[];
  currentTechnicianId: string;
  technicians: TechnicianOption[];
  canManage: boolean;
}

export function InterventionQuickActions({
  interventionId,
  currentStatus,
  transitions,
  currentTechnicianId,
  technicians,
  canManage,
}: InterventionQuickActionsProps) {
  const [statusState, statusAction] = useActionState(changeInterventionStatusAction, IDLE_ACTION_STATE);
  const [assignState, assignAction] = useActionState(
    assignInterventionTechnicianAction,
    IDLE_ACTION_STATE,
  );
  const [deleteState, deleteAction] = useActionState(deleteInterventionAction, IDLE_ACTION_STATE);

  const firstTransition = transitions[0] ?? null;
  const [targetStatus, setTargetStatus] = useState<InterventionStatus>(firstTransition ?? currentStatus);

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {transitions.length === 0 ? (
          <p className="text-sm text-slate-500">
            No further status change is possible from {INTERVENTION_STATUS_META[currentStatus].label}.
          </p>
        ) : (
          <form action={statusAction} className="space-y-3">
            <input type="hidden" name="interventionId" value={interventionId} />
            <ActionAlert status={statusState.status} message={statusState.message} />

            <Field
              htmlFor="quick-status"
              label="Move to status"
              error={statusState.fieldErrors?.status?.[0]}
            >
              <Select
                id="quick-status"
                name="status"
                value={targetStatus}
                onChange={(event) => setTargetStatus(event.target.value as InterventionStatus)}
              >
                {transitions.map((status) => (
                  <option key={status} value={status}>
                    {INTERVENTION_STATUS_META[status].label} — {INTERVENTION_STATUS_META[status].description}
                  </option>
                ))}
              </Select>
            </Field>

            {targetStatus === 'completed' ? (
              <Field
                htmlFor="quick-completion-notes"
                label="Completion notes"
                hint="Stored with the completed intervention."
                error={statusState.fieldErrors?.completionNotes?.[0]}
              >
                <Textarea id="quick-completion-notes" name="completionNotes" rows={3} />
              </Field>
            ) : null}

            <SubmitButton pendingLabel="Updating…" size="sm">
              Change status
            </SubmitButton>
          </form>
        )}

        {canManage ? (
          <>
            <form action={assignAction} className="space-y-3 border-t border-slate-200 pt-5">
              <input type="hidden" name="interventionId" value={interventionId} />
              <ActionAlert status={assignState.status} message={assignState.message} />

              <Field
                htmlFor="quick-technician"
                label="Assigned technician"
                error={assignState.fieldErrors?.technicianId?.[0]}
              >
                <Select
                  id="quick-technician"
                  name="technicianId"
                  defaultValue={currentTechnicianId}
                >
                  <option value="">Unassigned</option>
                  {technicians.map((technician) => (
                    <option key={technician.id} value={technician.id}>
                      {technician.full_name}
                    </option>
                  ))}
                </Select>
              </Field>

              <SubmitButton variant="outline" size="sm" pendingLabel="Reassigning…">
                <UserCog aria-hidden className="size-4" />
                Update technician
              </SubmitButton>
            </form>

            <form action={deleteAction} className="space-y-3 border-t border-slate-200 pt-5">
              <input type="hidden" name="interventionId" value={interventionId} />
              <ActionAlert status={deleteState.status} message={deleteState.message} />

              <p className="text-sm text-slate-500">
                Deleting removes the intervention, its photos and its planning entries. The activity
                journal keeps a trace of the deletion.
              </p>

              <SubmitButton
                variant="danger"
                size="sm"
                pendingLabel="Deleting…"
                onClick={(event) => {
                  if (!window.confirm('Delete this intervention and its photos?')) {
                    event.preventDefault();
                  }
                }}
              >
                <Trash2 aria-hidden className="size-4" />
                Delete intervention
              </SubmitButton>
            </form>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
