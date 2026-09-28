'use server';

import { revalidatePath } from 'next/cache';

import { requireOrganization } from '@/lib/auth/session';
import { actionSuccess, toActionError, type ActionState } from '@/lib/errors';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formDataToObject } from '@/lib/validation/common';
import {
  invitationSchema,
  teamMemberRemoveSchema,
  teamMemberRoleSchema,
} from '@/lib/validation/organization';

async function requireAdmin() {
  const session = await requireOrganization();
  if (session.role !== 'admin') {
    throw new Error('insufficient_privileges');
  }
  return session;
}

/**
 * Creates an invitation row and returns its link. No service-role call is made
 * here: the invitee gets access by redeeming the token (see the /invite/[token]
 * page), which keeps this action safe to run with the anon key.
 */
export async function inviteMemberAction(
  _previous: ActionState<{ inviteUrl: string }>,
  formData: FormData,
): Promise<ActionState<{ inviteUrl: string }>> {
  const parsed = invitationSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  try {
    const session = await requireAdmin();
    const supabase = await createSupabaseServerClient();
    const email = parsed.data.email as string;

    // Re-use a pending invitation instead of creating duplicates.
    const { data: pending } = await supabase
      .from('organization_invitations')
      .select('id, token')
      .eq('organization_id', session.organization.id)
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle();

    let token = pending?.token ?? null;

    if (pending) {
      const { error } = await supabase
        .from('organization_invitations')
        .update({ role: parsed.data.role, expires_at: new Date(Date.now() + 14 * 864e5).toISOString() })
        .eq('id', pending.id);

      if (error) return toActionError(error);
    } else {
      const { data: created, error } = await supabase
        .from('organization_invitations')
        .insert({
          organization_id: session.organization.id,
          email,
          role: parsed.data.role,
          invited_by: session.user.id,
        })
        .select('token')
        .single();

      if (error) return toActionError(error);
      token = created.token;
    }

    revalidatePath('/settings/team');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') || '';
    const inviteUrl = `${appUrl}/invite/${token}`;

    return actionSuccess(
      pending
        ? 'Invitation refreshed. Share the link below with your colleague.'
        : 'Invitation created. Share the link below with your colleague.',
      { inviteUrl },
    );
  } catch (error) {
    return toActionError(error, 'We could not create the invitation.');
  }
}

export async function revokeInvitationAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireAdmin();
    const invitationId = String(formData.get('invitationId') ?? '');
    if (!invitationId) return toActionError(new Error('Invalid identifier'));

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from('organization_invitations')
      .update({ status: 'revoked' })
      .eq('id', invitationId)
      .eq('organization_id', session.organization.id);

    if (error) return toActionError(error);

    revalidatePath('/settings/team');
  } catch (error) {
    return toActionError(error, 'We could not revoke the invitation.');
  }

  return actionSuccess('Invitation revoked.');
}

export async function updateMemberRoleAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = teamMemberRoleSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  try {
    const session = await requireAdmin();
    const supabase = await createSupabaseServerClient();

    if (parsed.data.membershipId === session.organization.id) {
      return toActionError(new Error('insufficient_privileges'));
    }

    const { error } = await supabase
      .from('memberships')
      .update({ role: parsed.data.role })
      .eq('id', parsed.data.membershipId)
      .eq('organization_id', session.organization.id);

    if (error) return toActionError(error);

    revalidatePath('/settings/team');
  } catch (error) {
    return toActionError(error, 'We could not update this member.');
  }

  return actionSuccess('Member updated.');
}

export async function removeMemberAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = teamMemberRemoveSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  try {
    const session = await requireAdmin();
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from('memberships')
      .delete()
      .eq('id', parsed.data.membershipId)
      .eq('organization_id', session.organization.id);

    if (error) return toActionError(error);

    revalidatePath('/settings/team');
  } catch (error) {
    return toActionError(error, 'We could not remove this member.');
  }

  return actionSuccess('Member removed.');
}
