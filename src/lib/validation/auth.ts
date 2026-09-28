import { z } from 'zod';

import { requiredEmail, requiredText } from '@/lib/validation/common';

/**
 * Password policy: at least 8 characters with a letter and a digit.
 * Supabase enforces the same minimum on the Auth side.
 */
export const passwordSchema = z
  .string({ error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a digit');

export const signInSchema = z.object({
  email: requiredEmail,
  password: z.string().min(1, 'Password is required').max(72),
  redirectTo: z.string().max(500).optional(),
});

export const signUpSchema = z.object({
  fullName: requiredText(2, 120, 'Full name'),
  email: requiredEmail,
  password: passwordSchema,
  organizationName: requiredText(2, 120, 'Company name'),
  country: z
    .preprocess(
      (value) => (typeof value === 'string' ? value.trim().toUpperCase() : 'FR'),
      z.string().length(2),
    )
    .default('FR'),
  acceptTerms: z.literal(true, { error: 'You must accept the terms to create an account' }),
});

export const forgotPasswordSchema = z.object({
  email: requiredEmail,
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
