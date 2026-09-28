import { ZodError } from 'zod';

/**
 * Uniform result shape returned by every Server Action so forms can render
 * inline validation errors and toasts without custom plumbing.
 */
export interface ActionState<TData = undefined> {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Record<string, string[]>;
  data?: TData;
}

export const IDLE_ACTION_STATE: ActionState = { status: 'idle' };

export function actionSuccess<TData>(message: string, data?: TData): ActionState<TData> {
  return { status: 'success', message, data };
}

export function actionError(
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionState<never> {
  return { status: 'error', message, fieldErrors };
}

/** Human readable messages for the error codes raised by our SQL functions. */
const DATABASE_MESSAGES: Record<string, string> = {
  authentication_required: 'Your session expired. Please sign in again.',
  not_a_member_of_organization: 'You no longer have access to this organisation.',
  insufficient_privileges: 'You do not have permission to perform this action.',
  cross_tenant_reference_blocked: 'This record belongs to another organisation.',
  organization_requires_an_admin: 'An organisation must always keep at least one administrator.',
  organization_name_too_short: 'The organisation name is too short.',
  address_does_not_belong_to_customer: 'The selected address does not belong to this customer.',
  technician_user_not_member_of_organization:
    'This user is not a member of the organisation yet.',
  quote_must_be_accepted: 'Only an accepted quote can be turned into an invoice.',
  quote_not_found: 'This quote no longer exists.',
  intervention_not_found: 'This intervention no longer exists.',
  invoice_already_exists_for_intervention: 'This intervention has already been invoiced.',
  invitation_not_found: 'This invitation link is invalid or has already been used.',
  invitation_expired: 'This invitation has expired. Ask an administrator for a new one.',
  invitation_email_mismatch:
    'This invitation was issued for a different e-mail address. Sign in with that address.',
  unsupported_document_kind: 'Unsupported document type.',
};

const PG_CODE_MESSAGES: Record<string, string> = {
  '23505': 'This record already exists.',
  '23503': 'A related record is missing (it may have been deleted).',
  '23514': 'The submitted values do not satisfy the business rules.',
  '23502': 'A required field is missing.',
  '22P02': 'One of the submitted values has an invalid format.',
  '42501': 'You do not have permission to perform this action.',
  '42P01': 'The database schema is out of date. Run the migrations.',
  PGRST116: 'The record was not found or is not accessible.',
  PGRST301: 'Your session expired. Please sign in again.',
};

interface PostgresLikeError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

function asPostgresError(error: unknown): PostgresLikeError | null {
  if (typeof error === 'object' && error !== null) {
    return error as PostgresLikeError;
  }
  return null;
}

/**
 * Next.js signals `redirect()`/`notFound()` by throwing an object with a
 * `NEXT_*` digest. Those must never be converted into a user-facing error.
 */
export function isNextControlFlowError(error: unknown): boolean {
  const candidate = error as { digest?: unknown } | null;
  return typeof candidate?.digest === 'string' && candidate.digest.startsWith('NEXT_');
}

/** Maps Zod issues to the `fieldErrors` shape used by the forms. */
export function zodToActionError(error: ZodError): ActionState<never> {
  const flattened = error.flatten();
  const fieldErrors: Record<string, string[]> = {};

  for (const [field, messages] of Object.entries(flattened.fieldErrors)) {
    if (Array.isArray(messages) && messages.length > 0) {
      fieldErrors[field] = messages.filter((message): message is string => Boolean(message));
    }
  }

  const formMessages = flattened.formErrors.filter(Boolean);

  return {
    status: 'error',
    message: formMessages[0] ?? 'Please fix the highlighted fields.',
    fieldErrors,
  };
}

/** Converts any thrown value into a safe, user-facing `ActionState`. */
export function toActionError(error: unknown, fallback = 'Something went wrong.'): ActionState<never> {
  if (error instanceof ZodError) return zodToActionError(error);

  const pgError = asPostgresError(error);
  const rawMessage = pgError?.message ?? (error instanceof Error ? error.message : '');

  for (const [key, message] of Object.entries(DATABASE_MESSAGES)) {
    if (rawMessage.includes(key)) return { status: 'error', message };
  }

  const code = pgError?.code;
  if (code && PG_CODE_MESSAGES[code]) {
    return { status: 'error', message: PG_CODE_MESSAGES[code] };
  }

  if (error instanceof Error && error.name === 'ConfigurationError') {
    return { status: 'error', message: error.message };
  }

  // Log server-side details, never leak them to the browser.
  console.error('[action-error]', error);

  return { status: 'error', message: fallback };
}

/** Thrown by the data layer when a resource is not visible to the caller. */
export class NotFoundError extends Error {
  constructor(entity: string) {
    super(`${entity} not found`);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}
