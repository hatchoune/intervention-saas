import { z } from 'zod';

import {
  commaSeparatedList,
  nullableEmail,
  nullablePhone,
  nullableText,
  nullableUuid,
  requiredUuid,
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

export const customerTypeSchema = z.enum(['individual', 'company']);
export const customerStatusSchema = z.enum(['active', 'archived']);

export const customerSchema = z
  .object({
    type: customerTypeSchema,
    status: customerStatusSchema.default('active'),
    firstName: nullableText(80, 'First name'),
    lastName: nullableText(80, 'Last name'),
    companyName: nullableText(160, 'Company name'),
    contactName: nullableText(120, 'Contact name'),
    email: nullableEmail(),
    phone: nullablePhone(),
    mobile: nullablePhone('Mobile'),
    website: websiteUrl,
    vatNumber: nullableText(40, 'VAT number'),
    registrationNumber: nullableText(60, 'Registration number'),
    addressLine1: nullableText(160, 'Address'),
    addressLine2: nullableText(160, 'Address line 2'),
    postalCode: nullableText(20, 'Postal code'),
    city: nullableText(80, 'City'),
    country: z.preprocess(
      (value) =>
        typeof value === 'string' && value.trim() !== '' ? value.trim().toUpperCase() : 'FR',
      z.string().length(2, 'Use a 2-letter country code'),
    ),
    notes: nullableText(4000, 'Notes'),
    tags: commaSeparatedList,
  })
  .superRefine((data, ctx) => {
    if (data.type === 'company' && !data.companyName) {
      ctx.addIssue({
        code: 'custom',
        path: ['companyName'],
        message: 'Company name is required for a company customer',
      });
    }

    if (data.type === 'individual' && !data.firstName && !data.lastName) {
      ctx.addIssue({
        code: 'custom',
        path: ['lastName'],
        message: 'Enter at least a first or last name',
      });
    }
  });

export const customerAddressSchema = z.object({
  customerId: requiredUuid,
  addressId: nullableUuid,
  label: z
    .preprocess(
      (value) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : 'Main site'),
      z.string().min(1).max(80),
    )
    .default('Main site'),
  addressLine1: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z.string({ error: 'Address is required' }).min(2, 'Address is required').max(160),
  ),
  addressLine2: nullableText(160, 'Address line 2'),
  postalCode: nullableText(20, 'Postal code'),
  city: nullableText(80, 'City'),
  country: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() !== '' ? value.trim().toUpperCase() : 'FR'),
    z.string().length(2),
  ),
  accessNotes: nullableText(1000, 'Access notes'),
  isDefault: z.preprocess((value) => value === 'on' || value === 'true' || value === true, z.boolean()),
});

export const customerIdSchema = z.object({ id: requiredUuid });

export type CustomerInput = z.infer<typeof customerSchema>;
export type CustomerAddressInput = z.infer<typeof customerAddressSchema>;
