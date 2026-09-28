'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { ActionAlert } from '@/components/ui/alert';
import { Checkbox, Field, Input } from '@/components/ui/controls';
import { SubmitButton } from '@/components/ui/submit-button';
import { signUpAction } from '@/lib/actions/auth';
import { IDLE_ACTION_STATE } from '@/lib/errors';

const COUNTRIES = [
  ['FR', 'France'],
  ['BE', 'Belgium'],
  ['CH', 'Switzerland'],
  ['LU', 'Luxembourg'],
  ['DE', 'Germany'],
  ['NL', 'Netherlands'],
  ['ES', 'Spain'],
  ['IT', 'Italy'],
  ['PT', 'Portugal'],
  ['GB', 'United Kingdom'],
  ['IE', 'Ireland'],
  ['US', 'United States'],
  ['CA', 'Canada'],
];

export function SignUpForm() {
  const [state, formAction] = useActionState(signUpAction, IDLE_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status !== 'idle' ? (
        <ActionAlert status={state.status} message={state.message} />
      ) : null}

      <Field
        htmlFor="organizationName"
        label="Company name"
        hint="This creates your workspace. Invite colleagues afterwards."
        required
        error={state.fieldErrors?.organizationName?.[0]}
      >
        <Input
          id="organizationName"
          name="organizationName"
          required
          autoComplete="organization"
          placeholder="Dupont Plumbing"
          hasError={Boolean(state.fieldErrors?.organizationName)}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          htmlFor="fullName"
          label="Your name"
          required
          error={state.fieldErrors?.fullName?.[0]}
        >
          <Input
            id="fullName"
            name="fullName"
            required
            autoComplete="name"
            hasError={Boolean(state.fieldErrors?.fullName)}
          />
        </Field>

        <Field htmlFor="country" label="Country" error={state.fieldErrors?.country?.[0]}>
          <select
            id="country"
            name="country"
            defaultValue="FR"
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
          >
            {COUNTRIES.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field htmlFor="email" label="Work e-mail" required error={state.fieldErrors?.email?.[0]}>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          hasError={Boolean(state.fieldErrors?.email)}
        />
      </Field>

      <Field
        htmlFor="password"
        label="Password"
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

      <div className="space-y-1">
        <Checkbox
          id="acceptTerms"
          name="acceptTerms"
          label="I accept the terms of service"
          description="Your data stays in your organisation and is isolated with Row Level Security."
        />
        {state.fieldErrors?.acceptTerms?.[0] ? (
          <p role="alert" className="text-xs font-medium text-rose-600">
            {state.fieldErrors.acceptTerms[0]}
          </p>
        ) : null}
      </div>

      <SubmitButton className="w-full" pendingLabel="Creating your workspace…">
        Create my workspace
      </SubmitButton>

      <p className="text-sm text-slate-600">
        Already have an account?{' '}
        <Link href="/sign-in" className="font-medium text-indigo-600 hover:text-indigo-500">
          Sign in
        </Link>
        .
      </p>
    </form>
  );
}
