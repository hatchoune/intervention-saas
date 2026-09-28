'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { ACTIVE_ORGANIZATION_COOKIE } from '@/lib/auth/session';
import { APP_URL } from '@/lib/env';
import { actionError, actionSuccess, toActionError, type ActionState } from '@/lib/errors';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formDataToObject } from '@/lib/validation/common';
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from '@/lib/validation/auth';

export type AuthActionState = ActionState;

function safeNext(next: unknown, fallback = '/dashboard'): string {
  if (typeof next !== 'string') return fallback;
  // Only allow same-origin relative redirects.
  if (!next.startsWith('/') || next.startsWith('//')) return fallback;
  return next;
}

/**
 * Creates the account, then (when e-mail confirmation is disabled) the
 * organisation, so the user lands directly in a usable workspace.
 */
export async function signUpAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  try {
    const supabase = await createSupabaseServerClient();
    const { fullName, email, password, organizationName, country } = parsed.data;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${APP_URL}/auth/callback?next=/onboarding`,
      },
    });

    if (error) {
      if (error.message.toLowerCase().includes('already')) {
        return actionError('An account already exists for this e-mail address.');
      }
      return actionError(error.message);
    }

    if (!data.session) {
      // E-mail confirmation is enabled: the user must confirm before signing in.
      redirect(`/verify-email?email=${encodeURIComponent(email)}`);
    }

    const { data: organizationId, error: organizationError } = await supabase.rpc(
      'create_organization',
      { p_name: organizationName, p_country: country },
    );

    if (organizationError || !organizationId) {
      redirect('/onboarding');
    }

    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_ORGANIZATION_COOKIE, organizationId, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    });
  } catch (error) {
    return toActionError(error, 'We could not create your account.');
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard?welcome=1');
}

export async function signInAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signInSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  let destination = safeNext(parsed.data.redirectTo);

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) {
      return actionError(
        error.message.toLowerCase().includes('invalid')
          ? 'Incorrect e-mail address or password.'
          : 'We could not sign you in. Please try again.',
      );
    }

    const { data: memberships } = await supabase.rpc('current_user_organizations');

    const primaryMembership = memberships?.[0];

    if (primaryMembership) {
      const cookieStore = await cookies();
      cookieStore.set(ACTIVE_ORGANIZATION_COOKIE, primaryMembership.organization_id, {
        path: '/',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
      });

      if (destination === '/dashboard' && primaryMembership.role === 'technician') {
        destination = '/planning';
      }
    } else if (destination === '/dashboard') {
      destination = '/onboarding';
    }
  } catch (error) {
    return toActionError(error, 'We could not sign you in.');
  }

  revalidatePath('/', 'layout');
  redirect(destination);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_ORGANIZATION_COOKIE);

  revalidatePath('/', 'layout');
  redirect('/sign-in?signedOut=1');
}

export async function forgotPasswordAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${APP_URL}/auth/callback?next=/reset-password`,
    });

    if (error) return actionError(error.message);
  } catch (error) {
    return toActionError(error, 'We could not send the reset e-mail.');
  }

  // Always report success so the endpoint cannot be used to enumerate accounts.
  return actionSuccess(
    'If an account exists for this address, a password reset link is on its way.',
  );
}

export async function resetPasswordAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return toActionError(parsed.error);

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

    if (error) return actionError(error.message);
  } catch (error) {
    return toActionError(error, 'We could not update your password.');
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard?passwordUpdated=1');
}

