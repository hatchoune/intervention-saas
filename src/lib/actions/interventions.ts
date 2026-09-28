'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireOrganization, type SessionContext } from '@/lib/auth/session';
import {
  INTERVENTION_ENTITY_TYPE,
  INTERVENTION_PHOTO_BUCKET,
} from '@/lib/db/interventions';
import { can, canEditIntervention } from '@/lib/domain/permissions';
import { INTERVENTION_STATUS_META, canTransitionIntervention } from '@/lib/domain/status';
import { actionError, actionSuccess, toActionError, type ActionState } from '@/lib/errors';
import { createSupabaseServerClient, type SupabaseServerClient } from '@/lib/supabase/server';
import { formDataToObject } from '@/lib/validation/common';
import {
  interventionAssignSchema,
  interventionIdSchema,
  interventionPhotoDeleteSchema,
  interventionPhotoSchema,
  interventionSchema,
  interventionStatusChangeSchema,
  interventionUpdateSchema,
  type InterventionInput,
} from '@/lib/validation/intervention';
import type { ActivityAction, InterventionRow, Json, TablesUpdate } from '@/types/database';

/**
 * Server Actions for the Interventions module.
 *
 * Every mutation follows the house rules: resolve the session, validate with
 * zod, re-check the authorisation (RLS remains the final gate), write, log to
 * `activity_log`, then `revalidatePath`.
 */

type Session = SessionContext & {
  organization: { id: string };
  role: 'admin' | 'manager' | 'technician';
};

function invalidate(interventionId?: string): void {
  revalidatePath('/interventions');
  revalidatePath('/planning');
  revalidatePath('/planning/week');
  revalidatePath('/planning/upcoming');
  revalidatePath('/dashboard');
  if (interventionId) revalidatePath(`/interventions/${interventionId}`);
}

async function logActivity(
  supabase: SupabaseServerClient,
  session: Session,
  params: {
    action: ActivityAction;
    entityId: string;
    entityLabel: string;
    summary: string;
    metadata?: Json;
  },
): Promise<void> {
  // Fire-and-forget: an audit failure must never fail the user's mutation.
  const { error } = await supabase.rpc('log_activity', {
    p_organization_id: session.organization.id,
    p_action: params.action,
    p_entity_type: INTERVENTION_ENTITY_TYPE,
    p_entity_id: params.entityId,
    p_entity_label: params.entityLabel,
    p_summary: params.summary,
    p_metadata: params.metadata ?? {},
  });

  if (error) console.error('[log_activity]', error.message);
}

async function requireManagerSession(): Promise<Session> {
  const session = await requireOrganization();
  if (!can('interventions.manage', session.role)) {
    throw new Error('insufficient_privileges');
  }
  return session as Session;
}

/**
 * Loads an intervention scoped to the tenant. Returns `null` when it does not
 * exist or is not visible, so nothing leaks across organisations.
 */
async function loadIntervention(
  supabase: SupabaseServerClient,
  organizationId: string,
  id: string,
): Promise<InterventionRow | null> {
  const { data, error } = await supabase
    .from('interventions')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

/** Managers may edit anything; technicians only their assigned work. */
async function assertCanEdit(
  supabase: SupabaseServerClient,
  session: Session,
  intervention: InterventionRow,
): Promise<void> {
  if (can('interventions.manage', session.role)) return;

  let assignedUserId: string | null = null;

  if (intervention.technician_id) {
    const { data } = await supabase
      .from('technicians')
      .select('*')
      .eq('id', intervention.technician_id)
      .maybeSingle();
    assignedUserId = data?.user_id ?? null;
  }

  const allowed = canEditIntervention(session.role, {
    assignedTechnicianUserId: assignedUserId,
    userId: session.user.id,
  });

  if (!allowed) throw new Error('insufficient_privileges');
}

/** camelCase form values -> database column names. */
function toRowValues(input: InterventionInput): TablesUpdate<'interventions'> {
  return {
    customer_id: input.customerId,
    customer_address_id: input.customerAddressId,
    technician_id: input.technicianId,
    title: input.title,
    description: input.description,
    internal_notes: input.internalNotes,
    status: input.status,
    priority: input.priority,
    scheduled_start: input.scheduledStart,
    scheduled_end: input.scheduledEnd,
    address_line1: input.addressLine1,
    address_line2: input.addressLine2,
    postal_code: input.postalCode,
    city: input.city,
    country: input.country,
  };
}

function labelOf(intervention: Pick<InterventionRow, 'reference' | 'title'>): string {
  return `${intervention.reference} — ${intervention.title}`;
}

// ---------------------------------------------------------------------------
// Create / update
// ---------------------------------------------------------------------------

export async function createInterventionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = interventionSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  let createdId: string | null = null;

  try {
    const session = await requireManagerSession();
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('interventions')
      .insert({
        ...toRowValues(parsed.data),
        organization_id: session.organization.id,
        customer_id: parsed.data.customerId,
        title: parsed.data.title,
        created_by: session.user.id,
        updated_by: session.user.id,
      })
      .select('*')
      .single();

    if (error) return toActionError(error);

    createdId = data.id;

    await logActivity(supabase, session, {
      action: 'created',
      entityId: data.id,
      entityLabel: labelOf(data),
      summary: `Intervention ${data.reference} created`,
      metadata: { status: data.status, priority: data.priority },
    });

    invalidate(data.id);
  } catch (error) {
    return toActionError(error, 'We could not save this intervention.');
  }

  if (createdId) redirect(`/interventions/${createdId}`);

  return actionSuccess('Intervention created.');
}

export async function updateInterventionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = interventionUpdateSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  const { id, ...values } = parsed.data;

  try {
    const session = await requireOrganization();
    const supabase = await createSupabaseServerClient();
    const existing = await loadIntervention(supabase, session.organization.id, id);

    if (!existing) return toActionError(new Error('intervention_not_found'));

    await assertCanEdit(supabase, session as Session, existing);

    if (
      existing.status !== values.status &&
      !canTransitionIntervention(existing.status, values.status)
    ) {
      return actionError(
        `A ${INTERVENTION_STATUS_META[existing.status].label} intervention cannot move to ` +
          `${INTERVENTION_STATUS_META[values.status].label}.`,
      );
    }

    const { error } = await supabase
      .from('interventions')
      .update({ ...toRowValues(values), updated_by: session.user.id })
      .eq('id', id)
      .eq('organization_id', session.organization.id);

    if (error) return toActionError(error);

    await logActivity(supabase, session as Session, {
      action: 'updated',
      entityId: id,
      entityLabel: labelOf(existing),
      summary: `Intervention ${existing.reference} updated`,
    });

    invalidate(id);
  } catch (error) {
    return toActionError(error, 'We could not save this intervention.');
  }

  return actionSuccess('Intervention updated.');
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteInterventionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = interventionIdSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  try {
    const session = await requireManagerSession();
    const supabase = await createSupabaseServerClient();
    const existing = await loadIntervention(
      supabase,
      session.organization.id,
      parsed.data.interventionId,
    );

    if (!existing) return toActionError(new Error('intervention_not_found'));

    // Storage objects are not removed by the FK cascade: drop them explicitly.
    const { data: photos } = await supabase
      .from('intervention_photos')
      .select('*')
      .eq('organization_id', session.organization.id)
      .eq('intervention_id', existing.id);

    const storedPhotos = photos ?? [];
    if (storedPhotos.length > 0) {
      const bucket = storedPhotos[0]?.storage_bucket ?? INTERVENTION_PHOTO_BUCKET;
      const { error: storageError } = await supabase.storage
        .from(bucket)
        .remove(storedPhotos.map((photo) => photo.storage_path));

      if (storageError) console.error('[storage.remove]', storageError.message);
    }

    const { error } = await supabase
      .from('interventions')
      .delete()
      .eq('id', existing.id)
      .eq('organization_id', session.organization.id);

    if (error) return toActionError(error);

    await logActivity(supabase, session, {
      action: 'deleted',
      entityId: existing.id,
      entityLabel: labelOf(existing),
      summary: `Intervention ${existing.reference} deleted`,
    });

    invalidate();
  } catch (error) {
    return toActionError(error, 'We could not delete this intervention.');
  }

  redirect('/interventions');
}

// ---------------------------------------------------------------------------
// Status & assignment
// ---------------------------------------------------------------------------

export async function changeInterventionStatusAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = interventionStatusChangeSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  const { interventionId, status, completionNotes } = parsed.data;

  try {
    const session = await requireOrganization();
    const supabase = await createSupabaseServerClient();
    const existing = await loadIntervention(supabase, session.organization.id, interventionId);

    if (!existing) return toActionError(new Error('intervention_not_found'));

    await assertCanEdit(supabase, session as Session, existing);

    if (existing.status === status) {
      return actionError('This intervention is already in that status.');
    }

    if (!canTransitionIntervention(existing.status, status)) {
      return actionError(
        `A ${INTERVENTION_STATUS_META[existing.status].label} intervention cannot move to ` +
          `${INTERVENTION_STATUS_META[status].label}.`,
      );
    }

    const payload: TablesUpdate<'interventions'> = {
      status,
      updated_by: session.user.id,
      // Completion notes only make sense while the job is completed.
      completion_notes: status === 'completed' ? completionNotes : null,
    };

    const { error } = await supabase
      .from('interventions')
      .update(payload)
      .eq('id', interventionId)
      .eq('organization_id', session.organization.id);

    if (error) return toActionError(error);

    await logActivity(supabase, session as Session, {
      action: 'status_changed',
      entityId: interventionId,
      entityLabel: labelOf(existing),
      summary:
        `Status ${INTERVENTION_STATUS_META[existing.status].label} → ` +
        INTERVENTION_STATUS_META[status].label,
      metadata: { from: existing.status, to: status },
    });

    invalidate(interventionId);
  } catch (error) {
    return toActionError(error, 'We could not update the status.');
  }

  return actionSuccess('Status updated.');
}

export async function assignInterventionTechnicianAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = interventionAssignSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  try {
    const session = await requireManagerSession();
    const supabase = await createSupabaseServerClient();
    const existing = await loadIntervention(
      supabase,
      session.organization.id,
      parsed.data.interventionId,
    );

    if (!existing) return toActionError(new Error('intervention_not_found'));

    let technicianLabel = 'Unassigned';

    if (parsed.data.technicianId) {
      const { data: technician } = await supabase
        .from('technicians')
        .select('*')
        .eq('organization_id', session.organization.id)
        .eq('id', parsed.data.technicianId)
        .maybeSingle();

      if (!technician) {
        return toActionError(new Error('technician_user_not_member_of_organization'));
      }

      technicianLabel = technician.full_name;
    }

    const { error } = await supabase
      .from('interventions')
      .update({ technician_id: parsed.data.technicianId, updated_by: session.user.id })
      .eq('id', existing.id)
      .eq('organization_id', session.organization.id);

    if (error) return toActionError(error);

    await logActivity(supabase, session, {
      action: 'updated',
      entityId: existing.id,
      entityLabel: labelOf(existing),
      summary: `Assigned to ${technicianLabel}`,
      metadata: { technician_id: parsed.data.technicianId },
    });

    invalidate(existing.id);
  } catch (error) {
    return toActionError(error, 'We could not reassign this intervention.');
  }

  return actionSuccess('Technician updated.');
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

export async function attachInterventionPhotoAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = interventionPhotoSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  try {
    const session = await requireOrganization();
    const supabase = await createSupabaseServerClient();
    const existing = await loadIntervention(
      supabase,
      session.organization.id,
      parsed.data.interventionId,
    );

    if (!existing) return toActionError(new Error('intervention_not_found'));

    await assertCanEdit(supabase, session as Session, existing);

    // The object path convention is part of the storage RLS contract.
    const expectedPrefix = `${session.organization.id}/${existing.id}/`;
    if (!parsed.data.storagePath.startsWith(expectedPrefix)) {
      return actionError('This file does not belong to this intervention.');
    }

    const { error } = await supabase.from('intervention_photos').insert({
      organization_id: session.organization.id,
      intervention_id: existing.id,
      kind: parsed.data.kind,
      storage_bucket: INTERVENTION_PHOTO_BUCKET,
      storage_path: parsed.data.storagePath,
      file_name: parsed.data.fileName,
      mime_type: parsed.data.mimeType,
      size_bytes: parsed.data.sizeBytes,
      caption: parsed.data.caption,
      uploaded_by: session.user.id,
    });

    if (error) return toActionError(error);

    await logActivity(supabase, session as Session, {
      action: 'updated',
      entityId: existing.id,
      entityLabel: labelOf(existing),
      summary: `${parsed.data.kind === 'before' ? 'Before' : 'After'} photo added`,
    });

    revalidatePath(`/interventions/${existing.id}`);
  } catch (error) {
    return toActionError(error, 'We could not save this photo.');
  }

  return actionSuccess('Photo added.');
}

export async function deleteInterventionPhotoAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = interventionPhotoDeleteSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  try {
    const session = await requireOrganization();
    const supabase = await createSupabaseServerClient();

    const { data: photo, error: photoError } = await supabase
      .from('intervention_photos')
      .select('*')
      .eq('organization_id', session.organization.id)
      .eq('id', parsed.data.photoId)
      .maybeSingle();

    if (photoError) return toActionError(photoError);
    if (!photo) return actionError('This photo no longer exists.');

    // Mirrors the storage delete policy: managers, or the uploader.
    const allowed =
      can('interventions.manage', session.role) || photo.uploaded_by === session.user.id;

    if (!allowed) throw new Error('insufficient_privileges');

    const { error: storageError } = await supabase.storage
      .from(photo.storage_bucket)
      .remove([photo.storage_path]);

    if (storageError) console.error('[storage.remove]', storageError.message);

    const { error } = await supabase
      .from('intervention_photos')
      .delete()
      .eq('id', photo.id)
      .eq('organization_id', session.organization.id);

    if (error) return toActionError(error);

    await logActivity(supabase, session as Session, {
      action: 'updated',
      entityId: photo.intervention_id,
      entityLabel: photo.file_name ?? photo.storage_path,
      summary: 'Photo removed',
    });

    revalidatePath(`/interventions/${photo.intervention_id}`);
  } catch (error) {
    return toActionError(error, 'We could not remove this photo.');
  }

  return actionSuccess('Photo removed.');
}
