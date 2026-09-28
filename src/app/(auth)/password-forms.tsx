'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { ActionAlert } from '@/components/ui/alert';
import { Field, Input } from '@/components/ui/controls';
import { SubmitButton } from '@/components/ui/submit-button';
import { forgotPasswordAction, resetPasswordAction } from '@/lib/actions/auth';
import { IDLE_ACTION_STATE } from '@/lib/errors';

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPasswordAction, IDLE_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status !== 'idle' ? (
        <ActionAlert status={state.status} message={state.message} />
      ) : null}

      <Field htmlFor="email" label="E-mail address" required error={state.fieldErrors?.email?.[0]}>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          hasError={Boolean(state.fieldErrors?.email)}
        />
      </Field>

      <SubmitButton className="w-full" pendingLabel="Sending…">
        Send the reset link
      </SubmitButton>

      <p className="text-sm text-slate-600">
        <Link href="/sign-in" className="font-medium text-indigo-600 hover:text-indigo-500">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(resetPasswordAction, IDLE_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status !== 'idle' ? (
        <ActionAlert status={state.status} message={state.message} />
      ) : null}

      <Field
        htmlFor="password"
        label="New password"
        hint="At least 8 characters, including a letter and a number."
        required
        error={state.fieldErrors?.password?.[0]}
      >
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          hasError={Boolean(state.fieldErrors?.password)}
        />
      </Field>

      <Field
        htmlFor="confirmPassword"
        label="Confirm the new password"
        required
        error={state.fieldErrors?.confirmPassword?.[0]}
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          hasError={Boolean(state.fieldErrors?.confirmPassword)}
        />
      </Field>

      <SubmitButton className="w-full" pendingLabel="Updating…">
        Update my password
      </SubmitButton>
    </form>
  );
}
