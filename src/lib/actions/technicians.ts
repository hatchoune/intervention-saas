'use server';

import { revalidatePath } from 'next/cache';

import { requireOrganization, type SessionContext } from '@/lib/auth/session';
import { TECHNICIAN_ENTITY_TYPE, countTechnicianDependencies } from '@/lib/db/technicians';
import { can } from '@/lib/domain/permissions';
import { actionError, actionSuccess, toActionError, type ActionState } from '@/lib/errors';
import { createSupabaseServerClient, type SupabaseServerClient } from '@/lib/supabase/server';
import { formDataToObject } from '@/lib/validation/common';
import {
  technicianIdSchema,
  technicianSchema,
  technicianStatusUpdateSchema,
  technicianUpdateSchema,
  type TechnicianInput,
} from '@/lib/validation/technician';
import type { Json } from '@/types/database';

/**
 * Server Actions for the Technicians module.
 *
 * Same contract as the other modules: resolve the session, validate with zod,
 * re-check the authorisation (RLS stays the final gate), write, append to
 * `activity_log`, then revalidate the affected routes.
 */

type Session = SessionContext & {
  organization: { id: string };
  role: 'admin' | 'manager' | 'technician';
};

const DEFAULT_COLOR = '#2563eb';

function invalidate(technicianId?: string): void {
  revalidatePath('/technicians');
  revalidatePath('/planning');
  revalidatePath('/planning/week');
  revalidatePath('/dashboard');
  if (technicianId) revalidatePath(`/technicians/${technicianId}`);
}

async function logActivity(
  supabase: SupabaseServerClient,
  session: Session,
  params: { entityId: string; entityLabel: string; summary: string; metadata?: Json },
): Promise<void> {
  // Fire-and-forget: an audit failure must never fail the user's mutation.
  const { error } = await supabase.rpc('log_activity', {
    p_organization_id: session.organization.id,
    p_action: 'updated',
    p_entity_type: TECHNICIAN_ENTITY_TYPE,
    p_entity_id: params.entityId,
    p_entity_label: params.entityLabel,
    p_summary: params.summary,
    p_metadata: params.metadata ?? {},
  });

  if (error) console.error('[log_activity]', error.message);
}

async function requireManagerSession(): Promise<Session> {
  const session = await requireOrganization();
  if (!can('technicians.manage', session.role)) throw new Error('insufficient_privileges');
  return session as Session;
}

/**
 * Maps the validated form payload onto the `technicians` columns. The return
 * type is inferred from the literals so the same object can be used for both
 * an insert (where `organization_id` is added) and an update.
 */
function toColumns(input: TechnicianInput) {
  return {
    full_name: input.fullName,
    email: input.email,
    phone: input.phone,
    job_title: input.jobTitle,
    skills: input.skills,
    status: input.status,
    color: input.color || DEFAULT_COLOR,
    hourly_rate: input.hourlyRate,
    user_id: input.userId,
    notes: input.notes,
    is_active: input.isActive,
  };
}

export async function createTechnicianAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = technicianSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  try {
    const session = await requireManagerSession();
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('technicians')
      .insert({
        organization_id: session.organization.id,
        created_by: session.user.id,
        ...toColumns(parsed.data),
      })
      .select('*')
      .single();

    if (error) return toActionError(error);

    await logActivity(supabase, session, {
      entityId: data.id,
      entityLabel: data.full_name,
      summary: `Technician ${data.full_name} added to the team`,
    });

    invalidate(data.id);
  } catch (error) {
    return toActionError(error, 'We could not save this technician.');
  }

  return actionSuccess('Technician created.');
}

export async function updateTechnicianAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = technicianUpdateSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  try {
    const session = await requireManagerSession();
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from('technicians')
      .update(toColumns(parsed.data))
      .eq('id', parsed.data.id)
      .eq('organization_id', session.organization.id);

    if (error) return toActionError(error);

    invalidate(parsed.data.id);
  } catch (error) {
    return toActionError(error, 'We could not save this technician.');
  }

  return actionSuccess('Technician updated.');
}

/**
 * Deletes a technician profile. Interventions reference technicians, so the
 * record is only removed when nothing is assigned to it: the alternative
 * (silently de-assigning live work) would hide history from the planning views.
 */
export async function deleteTechnicianAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = technicianIdSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  try {
    const session = await requireManagerSession();
    const supabase = await createSupabaseServerClient();

    const dependencies = await countTechnicianDependencies(
      session.organization.id,
      parsed.data.technicianId,
    );

    if (dependencies > 0) {
      return actionError(
        `This technician still has ${dependencies} intervention${dependencies === 1 ? '' : 's'}. ` +
          'Reassign or delete them first, or mark the technician as inactive.',
      );
    }

    const { error } = await supabase
      .from('technicians')
      .delete()
      .eq('id', parsed.data.technicianId)
      .eq('organization_id', session.organization.id);

    if (error) return toActionError(error);

    invalidate();
  } catch (error) {
    return toActionError(error, 'We could not delete this technician.');
  }

  return actionSuccess('Technician deleted.');
}

/**
 * Availability change. Managers may move anyone; a technician may only change
 * their own status, which mirrors the `technicians_update_manager` RLS policy
 * (`can_manage_org_data(...) or user_id = auth.uid()`).
 */
export async function changeTechnicianStatusAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = technicianStatusUpdateSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  try {
    const session = await requireOrganization();
    const supabase = await createSupabaseServerClient();

    const { data: technician, error: loadError } = await supabase
      .from('technicians')
      .select('*')
      .eq('organization_id', session.organization.id)
      .eq('id', parsed.data.technicianId)
      .maybeSingle();

    if (loadError) return toActionError(loadError);
    if (!technician) return actionError('This technician no longer exists.');

    const allowed =
      can('technicians.manage', session.role) || technician.user_id === session.user.id;

    if (!allowed) throw new Error('insufficient_privileges');

    const { error } = await supabase
      .from('technicians')
      .update({ status: parsed.data.status })
      .eq('id', technician.id)
      .eq('organization_id', session.organization.id);

    if (error) return toActionError(error);

    invalidate(technician.id);
  } catch (error) {
    return toActionError(error, 'We could not update the availability.');
  }

  return actionSuccess('Availability updated.');
}
