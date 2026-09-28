import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  actionError,
  actionSuccess,
  IDLE_ACTION_STATE,
  isNextControlFlowError,
  toActionError,
  zodToActionError,
} from '@/lib/errors';

describe('action state helpers', () => {
  it('builds success and error states', () => {
    expect(actionSuccess('Saved.')).toEqual({ status: 'success', message: 'Saved.', data: undefined });
    expect(actionError('Nope', { name: ['required'] })).toEqual({
      status: 'error',
      message: 'Nope',
      fieldErrors: { name: ['required'] },
    });
    expect(IDLE_ACTION_STATE.status).toBe('idle');
  });
});

describe('zodToActionError', () => {
  it('maps field errors and keeps the first form error as the message', () => {
    const schema = z.object({
      name: z.string().min(3, 'Too short'),
      email: z.email('Invalid e-mail'),
    });

    const result = schema.safeParse({ name: 'ab', email: 'nope' });
    expect(result.success).toBe(false);
    if (result.success) return;

    const state = zodToActionError(result.error);
    expect(state.status).toBe('error');
    expect(state.fieldErrors?.name).toEqual(['Too short']);
    expect(state.fieldErrors?.email?.[0]).toContain('mail');
  });

  it('falls back to a generic message when no field error is present', () => {
    const error = new z.ZodError([
      { code: 'custom', message: 'Global problem', path: [], input: undefined },
    ]);

    expect(zodToActionError(error).message).toBe('Global problem');
  });
});

describe('toActionError', () => {
  it('translates the custom messages raised by our SQL functions', () => {
    expect(toActionError({ code: 'P0001', message: 'quote_must_be_accepted' }).message).toBe(
      'Only an accepted quote can be turned into an invoice.',
    );
    expect(
      toActionError({ message: 'cross_tenant_reference_blocked' }).message,
    ).toBe('This record belongs to another organisation.');
  });

  it('translates PostgreSQL error codes', () => {
    expect(toActionError({ code: '23505', message: 'duplicate key value' }).message).toBe(
      'This record already exists.',
    );
    expect(toActionError({ code: '42501', message: 'permission denied' }).message).toBe(
      'You do not have permission to perform this action.',
    );
  });

  it('never leaks unknown server errors', () => {
    const state = toActionError(new Error('connect ECONNREFUSED 127.0.0.1:5432'));
    expect(state.status).toBe('error');
    expect(state.message).toBe('Something went wrong.');
    expect(state.message).not.toContain('ECONNREFUSED');
  });

  it('supports a custom fallback message', () => {
    expect(toActionError(new Error('boom'), 'Could not save.').message).toBe('Could not save.');
  });

  it('surfaces configuration errors verbatim', () => {
    const error = new Error('Supabase is not configured.');
    error.name = 'ConfigurationError';
    expect(toActionError(error).message).toBe('Supabase is not configured.');
  });
});

describe('isNextControlFlowError', () => {
  it('detects redirect/notFound digests so they are never swallowed', () => {
    expect(isNextControlFlowError({ digest: 'NEXT_REDIRECT;replace;/dashboard' })).toBe(true);
    expect(isNextControlFlowError({ digest: 'NEXT_NOT_FOUND' })).toBe(true);
    expect(isNextControlFlowError(new Error('boom'))).toBe(false);
    expect(isNextControlFlowError(null)).toBe(false);
  });
});
