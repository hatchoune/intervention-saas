import { z } from 'zod';

import {
  currencyCode,
  decimalNumber,
  nullableEmail,
  nullablePhone,
  nullableText,
  requiredText,
} from '@/lib/validation/common';

const websiteUrl = z
  .preprocess(
    (value) => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      if (trimmed === '') return null;
      return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    },
    z.url('Enter a valid website address').max(200).nullable(),
  )
  .transform((value) => value ?? null);

export const organizationProfileSchema = z.object({
  name: requiredText(2, 120, 'Company name'),
  legalName: nullableText(160, 'Legal name'),
  email: nullableEmail('Company e-mail'),
  phone: nullablePhone('Company phone'),
  website: websiteUrl,
  addressLine1: nullableText(160, 'Address'),
  addressLine2: nullableText(160, 'Address line 2'),
  postalCode: nullableText(20, 'Postal code'),
  city: nullableText(80, 'City'),
  country: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() !== '' ? value.trim().toUpperCase() : 'FR'),
    z.string().length(2, 'Use a 2-letter country code'),
  ),
  vatNumber: nullableText(40, 'VAT number'),
  registrationNumber: nullableText(60, 'Registration number'),
  currency: currencyCode,
  defaultVatRate: decimalNumber({ label: 'Default VAT rate', min: 0, max: 100, defaultValue: 20 }),
  paymentTermsDays: decimalNumber({
    label: 'Payment terms',
    min: 0,
    max: 365,
    defaultValue: 30,
  }),
  timezone: nullableText(60, 'Timezone'),
  quoteFooter: nullableText(1000, 'Quote footer'),
  invoiceFooter: nullableText(1000, 'Invoice footer'),
});

export const invitationSchema = z.object({
  email: nullableEmail('Invitee e-mail').refine((value) => value !== null, {
    message: 'E-mail is required',
  }),
  role: z.enum(['admin', 'manager', 'technician'], { error: 'Select a role' }),
  redirectTo: z.string().max(500).optional(),
});

export const teamMemberRoleSchema = z.object({
  membershipId: z.uuid('Invalid membership'),
  role: z.enum(['admin', 'manager', 'technician'], { error: 'Select a role' }),
});

export const teamMemberRemoveSchema = z.object({
  membershipId: z.uuid('Invalid membership'),
});

export const profileSchema = z.object({
  fullName: requiredText(2, 120, 'Full name'),
  phone: nullablePhone('Phone'),
  jobTitle: nullableText(80, 'Job title'),
  locale: z.enum(['fr', 'en']).catch('fr'),
});

export const organizationSwitchSchema = z.object({
  organizationId: z.uuid('Invalid organisation'),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(10).max(200),
});

export const createOrganizationSchema = z.object({
  name: requiredText(2, 120, 'Company name'),
  country: z
    .preprocess(
      (value) => (typeof value === 'string' && value.trim() !== '' ? value.trim().toUpperCase() : 'FR'),
      z.string().length(2),
    )
    .default('FR'),
  currency: currencyCode,
});

export type OrganizationProfileInput = z.infer<typeof organizationProfileSchema>;
export type InvitationInput = z.infer<typeof invitationSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
