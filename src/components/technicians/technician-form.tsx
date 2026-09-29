'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { ActionAlert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/controls';
import { SubmitButton } from '@/components/ui/submit-button';
import { createTechnicianAction, updateTechnicianAction } from '@/lib/actions/technicians';
import type { MemberOption } from '@/lib/db/technicians';
import { TECHNICIAN_STATUSES, TECHNICIAN_STATUS_META } from '@/lib/domain/status';
import { IDLE_ACTION_STATE } from '@/lib/errors';
import type { TechnicianStatus } from '@/types/database';

/**
 * Create / edit form for a technician profile.
 *
 * `userId` links the profile to a login so a technician can see their own day.
 * Members already linked to another profile are disabled rather than rejected by
 * the `unique (organization_id, user_id)` constraint.
 */

export interface TechnicianFormDefaults {
  id: string | null;
  fullName: string;
  email: string;
  phone: string;
  jobTitle: string;
  skills: string;
  status: TechnicianStatus;
  color: string;
  hourlyRate: string;
  userId: string;
  notes: string;
  isActive: boolean;
}

export interface TechnicianFormProps {
  mode: 'create' | 'update';
  members: MemberOption[];
  defaults: TechnicianFormDefaults;
  cancelHref: string;
}

export function TechnicianForm({ mode, members, defaults, cancelHref }: TechnicianFormProps) {
  const [state, formAction] = useActionState(
    mode === 'create' ? createTechnicianAction : updateTechnicianAction,
    IDLE_ACTION_STATE,
  );

  const fieldError = (field: string): string | undefined => state.fieldErrors?.[field]?.[0];

  return (
    <form action={formAction} className="space-y-6">
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <ActionAlert status={state.status} message={state.message} />

      <Card>
        <CardHeader>
          <CardTitle as="h2">Identity</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="fullName" label="Full name" required error={fieldError('fullName')}>
            <Input
              id="fullName"
              name="fullName"
              defaultValue={defaults.fullName}
              maxLength={120}
              autoComplete="name"
              hasError={Boolean(fieldError('fullName'))}
            />
          </Field>

          <Field htmlFor="jobTitle" label="Job title" error={fieldError('jobTitle')}>
            <Input
              id="jobTitle"
              name="jobTitle"
              defaultValue={defaults.jobTitle}
              maxLength={80}
              placeholder="Senior plumber"
            />
          </Field>

          <Field htmlFor="email" label="E-mail" error={fieldError('email')}>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={defaults.email}
              autoComplete="email"
              hasError={Boolean(fieldError('email'))}
            />
          </Field>

          <Field htmlFor="phone" label="Phone" error={fieldError('phone')}>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={defaults.phone}
              autoComplete="tel"
              hasError={Boolean(fieldError('phone'))}
            />
          </Field>

          <Field
            htmlFor="skills"
            label="Skills"
            hint="Comma separated, e.g. Heating, Boiler, Emergency."
            className="sm:col-span-2"
            error={fieldError('skills')}
          >
            <Input id="skills" name="skills" defaultValue={defaults.skills} maxLength={300} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Planning</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            htmlFor="status"
            label="Availability"
            hint={TECHNICIAN_STATUS_META[defaults.status].description}
          >
            <Select id="status" name="status" defaultValue={defaults.status}>
              {TECHNICIAN_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {TECHNICIAN_STATUS_META[status].label}
                </option>
              ))}
            </Select>
          </Field>

          <Field htmlFor="color" label="Calendar colour" error={fieldError('color')}>
            <Input
              id="color"
              name="color"
              type="color"
              defaultValue={defaults.color}
              className="h-10 p-1"
              hasError={Boolean(fieldError('color'))}
            />
          </Field>

          <Field
            htmlFor="hourlyRate"
            label="Hourly rate"
            hint="Optional. Internal costing only — never printed on customer documents."
            error={fieldError('hourlyRate')}
          >
            <Input
              id="hourlyRate"
              name="hourlyRate"
              inputMode="decimal"
              defaultValue={defaults.hourlyRate}
              hasError={Boolean(fieldError('hourlyRate'))}
            />
          </Field>

          <Field
            htmlFor="userId"
            label="Linked login"
            hint="Optional. Lets this person see their own schedule in the app."
            error={fieldError('userId')}
          >
            <Select id="userId" name="userId" defaultValue={defaults.userId}>
              <option value="">Not linked</option>
              {members.map((member) => (
                <option
                  key={member.userId}
                  value={member.userId}
                  disabled={Boolean(member.linkedTechnicianId)}
                >
                  {member.label}
                  {member.linkedTechnicianId ? ' — already linked' : ''}
                </option>
              ))}
            </Select>
          </Field>

          <div className="sm:col-span-2">
            <Checkbox
              id="isActive"
              name="isActive"
              label="Active"
              description="Inactive technicians stay in the history but are hidden from the planning board."
              defaultChecked={defaults.isActive}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Field htmlFor="notes" label="Internal notes" error={fieldError('notes')}>
            <Textarea id="notes" name="notes" defaultValue={defaults.notes} rows={4} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link href={cancelHref} className={buttonClasses('outline', 'md')}>
          Cancel
        </Link>
        <SubmitButton pendingLabel="Saving…">
          {mode === 'create' ? 'Create technician' : 'Save changes'}
        </SubmitButton>
      </div>
    </form>
  );
}
