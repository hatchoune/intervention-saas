'use client';

import { useActionState, useState } from 'react';

import { ActionAlert, Alert } from '@/components/ui/alert';
import { Field, Input, Select } from '@/components/ui/controls';
import { SubmitButton } from '@/components/ui/submit-button';
import { inviteMemberAction } from '@/lib/actions/team';
import type { ActionState } from '@/lib/errors';
import { ORGANIZATION_ROLE_META, ORGANIZATION_ROLES } from '@/lib/domain/status';

/**
 * Creates an invitation and shows the redeemable link. No transactional e-mail
 * is required: admins share the link, which is the honest behaviour for a
 * self-hosted deployment without SMTP.
 */
const IDLE_INVITE_STATE: ActionState<{ inviteUrl: string }> = { status: 'idle' };

export function InviteMemberForm() {
  const [state, formAction] = useActionState(inviteMemberAction, IDLE_INVITE_STATE);
  const [copied, setCopied] = useState(false);

  const inviteUrl = state.data?.inviteUrl;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status !== 'idle' ? (
        <ActionAlert status={state.status} message={state.message} />
      ) : null}

      {inviteUrl ? (
        <Alert variant="success" title="Invitation link ready">
          <div className="space-y-2">
            <p className="text-xs break-all">
              <code className="rounded bg-white px-1.5 py-0.5">{inviteUrl}</code>
            </p>
            <button
              type="button"
              className="rounded-md border border-emerald-300 bg-white px-2 py-1 text-xs font-medium text-emerald-800"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(inviteUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <p className="text-xs">
              It expires in 14 days and only works for the invited e-mail address.
            </p>
          </div>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Field htmlFor="invite-email" label="Colleague e-mail" required error={state.fieldErrors?.email?.[0]}>
          <Input
            id="invite-email"
            name="email"
            type="email"
            required
            placeholder="colleague@company.com"
            hasError={Boolean(state.fieldErrors?.email)}
          />
        </Field>

        <Field htmlFor="invite-role" label="Role" error={state.fieldErrors?.role?.[0]}>
          <Select id="invite-role" name="role" defaultValue="technician">
            {ORGANIZATION_ROLES.map((role) => (
              <option key={role} value={role}>
                {ORGANIZATION_ROLE_META[role].label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Creating…">Create invitation</SubmitButton>
      </div>
    </form>
  );
}
