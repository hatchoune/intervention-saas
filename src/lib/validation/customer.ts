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

/**
 * Shared field set for the create and update forms. Kept as a plain object so
 * `customerUpdateSchema` can `.extend()` it without duplicating any rule.
 */
const customerFields = {
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
    (value) => (typeof value === 'string' && value.trim() !== '' ? value.trim().toUpperCase() : 'FR'),
    z.string().length(2, 'Use a 2-letter country code'),
  ),
  notes: nullableText(4000, 'Notes'),
  tags: commaSeparatedList,
};

const customerBaseSchema = z.object(customerFields);

/** Name is required, and which name depends on the customer type. */
function refineCustomerName(
  data: { type: z.infer<typeof customerTypeSchema>; companyName: string | null; firstName: string | null; lastName: string | null },
  ctx: z.RefinementCtx,
): void {
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
}

export const customerSchema = customerBaseSchema.superRefine(refineCustomerName);

/** Same rules as the create form, targeting an existing record. */
export const customerUpdateSchema = customerBaseSchema
  .extend({ id: requiredUuid })
  .superRefine(refineCustomerName);;

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

/** Address mutations. `addressId` is set when editing an existing address. */
export const customerAddressIdSchema = z.object({
  customerId: requiredUuid,
  addressId: requiredUuid,
});

/** Archive / reactivate a customer from the list or detail page. */
export const customerStatusChangeSchema = z.object({
  id: requiredUuid,
  status: customerStatusSchema,
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;
export type CustomerAddressInput = z.infer<typeof customerAddressSchema>;
