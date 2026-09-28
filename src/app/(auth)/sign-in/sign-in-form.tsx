'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { Alert, ActionAlert } from '@/components/ui/alert';
import { Field, Input } from '@/components/ui/controls';
import { SubmitButton } from '@/components/ui/submit-button';
import { signInAction } from '@/lib/actions/auth';
import { IDLE_ACTION_STATE } from '@/lib/errors';

export function SignInForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction] = useActionState(signInAction, IDLE_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status !== 'idle' ? (
        <ActionAlert status={state.status} message={state.message} />
      ) : null}

      <input type="hidden" name="redirectTo" value={redirectTo ?? '/dashboard'} />

      <Field
        htmlFor="email"
        label="E-mail address"
        required
        error={state.fieldErrors?.email?.[0]}
      >
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@company.com"
          hasError={Boolean(state.fieldErrors?.email)}
        />
      </Field>

      <Field
        htmlFor="password"
        label="Password"
        required
        error={state.fieldErrors?.password?.[0]}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          hasError={Boolean(state.fieldErrors?.password)}
        />
      </Field>

      <div className="flex items-center justify-between">
        <Link
          href="/forgot-password"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          Forgot your password?
        </Link>
      </div>

      <SubmitButton className="w-full" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}

export function SignedOutNotice() {
  return <Alert variant="info">You have been signed out.</Alert>;
}
