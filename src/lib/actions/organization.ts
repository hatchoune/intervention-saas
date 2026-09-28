'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { ACTIVE_ORGANIZATION_COOKIE, requireSession } from '@/lib/auth/session';
import { actionSuccess, toActionError, type ActionState } from '@/lib/errors';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formDataToObject } from '@/lib/validation/common';
import {
  acceptInvitationSchema,
  createOrganizationSchema,
  organizationProfileSchema,
  organizationSwitchSchema,
  profileSchema,
} from '@/lib/validation/organization';

async function setActiveOrganizationCookie(organizationId: string) {
  const store = await cookies();
  store.set(ACTIVE_ORGANIZATION_COOKIE, organizationId, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });
}

/** Onboarding: creates the first organisation of a new account. */
export async function createOrganizationAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createOrganizationSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  try {
    await requireSession();
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.rpc('create_organization', {
      p_name: parsed.data.name,
      p_country: parsed.data.country,
      p_currency: parsed.data.currency,
    });

    if (error || !data) {
      return toActionError(error, 'We could not create the organisation.');
    }

    await setActiveOrganizationCookie(data);
  } catch (error) {
    return toActionError(error, 'We could not create the organisation.');
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard?organizationCreated=1');
}

export async function updateOrganizationProfileAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = organizationProfileSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  try {
    const session = await requireSession();
    if (!session.organization) return toActionError(new Error('not_a_member_of_organization'));
    if (session.role !== 'admin') return toActionError(new Error('insufficient_privileges'));

    const supabase = await createSupabaseServerClient();
    const data = parsed.data;

    const { error } = await supabase
      .from('organizations')
      .update({
        name: data.name,
        legal_name: data.legalName,
        email: data.email,
        phone: data.phone,
        website: data.website,
        address_line1: data.addressLine1,
        address_line2: data.addressLine2,
        postal_code: data.postalCode,
        city: data.city,
        country: data.country,
        vat_number: data.vatNumber,
        registration_number: data.registrationNumber,
        currency: data.currency,
        default_vat_rate: data.defaultVatRate,
        payment_terms_days: Math.round(data.paymentTermsDays),
        timezone: data.timezone ?? 'Europe/Paris',
        quote_footer: data.quoteFooter,
        invoice_footer: data.invoiceFooter,
      })
      .eq('id', session.organization.id);

    if (error) return toActionError(error);

    revalidatePath('/settings/organization');
    revalidatePath('/', 'layout');
  } catch (error) {
    return toActionError(error, 'We could not save the organisation.');
  }

  return actionSuccess('Organisation settings saved.');
}

/** Switches the organisation selected in the sidebar (cookie based). */
export async function switchOrganizationAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = organizationSwitchSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  try {
    const session = await requireSession();
    const isMember = session.memberships.some(
      (membership) => membership.organization_id === parsed.data.organizationId,
    );

    if (!isMember) return toActionError(new Error('not_a_member_of_organization'));

    await setActiveOrganizationCookie(parsed.data.organizationId);
    revalidatePath('/', 'layout');
  } catch (error) {
    return toActionError(error, 'We could not switch organisation.');
  }

  return actionSuccess('Organisation switched.');
}

export async function updateProfileAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = profileSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  try {
    const session = await requireSession();
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: parsed.data.fullName,
        phone: parsed.data.phone,
        job_title: parsed.data.jobTitle,
        locale: parsed.data.locale,
      })
      .eq('id', session.user.id);

    if (error) return toActionError(error);

    revalidatePath('/settings/profile');
    revalidatePath('/', 'layout');
  } catch (error) {
    return toActionError(error, 'We could not save your profile.');
  }

  return actionSuccess('Profile updated.');
}

/** Redeems an invitation token after the user signed in or signed up. */
export async function acceptInvitationAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = acceptInvitationSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  try {
    await requireSession();
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.rpc('accept_invitation', {
      p_token: parsed.data.token,
    });

    if (error || !data) return toActionError(error, 'We could not accept this invitation.');

    await setActiveOrganizationCookie(data);
    revalidatePath('/', 'layout');
  } catch (error) {
    return toActionError(error, 'We could not accept this invitation.');
  }

  redirect('/dashboard?invitationAccepted=1');
}

