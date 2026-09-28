'use client';

import { useActionState } from 'react';

import { ActionAlert } from '@/components/ui/alert';
import { Field, Input } from '@/components/ui/controls';
import { SubmitButton } from '@/components/ui/submit-button';
import { updateProfileAction } from '@/lib/actions/organization';
import { IDLE_ACTION_STATE } from '@/lib/errors';
import type { ProfileRow } from '@/types/database';

export function ProfileForm({
  profile,
  email,
}: {
  profile: ProfileRow | null;
  email: string;
}) {
  const [state, formAction] = useActionState(updateProfileAction, IDLE_ACTION_STATE);

  const error = (field: string) => state.fieldErrors?.[field]?.[0];

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status !== 'idle' ? (
        <ActionAlert status={state.status} message={state.message} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="fullName" label="Full name" required error={error('fullName')}>
          <Input
            id="fullName"
            name="fullName"
            defaultValue={profile?.full_name ?? ''}
            hasError={Boolean(state.fieldErrors?.fullName)}
          />
        </Field>

        <Field htmlFor="jobTitle" label="Job title" error={error('jobTitle')}>
          <Input id="jobTitle" name="jobTitle" defaultValue={profile?.job_title ?? ''} />
        </Field>

        <Field htmlFor="phone" label="Phone" error={error('phone')}>
          <Input id="phone" name="phone" type="tel" defaultValue={profile?.phone ?? ''} />
        </Field>

        <Field htmlFor="locale" label="Language" error={error('locale')}>
          <select
            id="locale"
            name="locale"
            defaultValue={profile?.locale ?? 'en'}
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
          >
            <option value="en">English</option>
            <option value="fr">Français</option>
          </select>
        </Field>
      </div>

      <Field htmlFor="email-readonly" label="E-mail address" hint="Contact an administrator to change it">
        <Input id="email-readonly" defaultValue={email} readOnly disabled />
      </Field>

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
      </div>
    </form>
  );
}
