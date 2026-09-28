import { z } from 'zod';

import {
  nullableDateTime,
  nullableText,
  nullableUuid,
  requiredText,
  requiredUuid,
} from '@/lib/validation/common';

export const interventionStatusSchema = z.enum([
  'draft',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
]);

export const interventionPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);

const countryField = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() !== '' ? value.trim().toUpperCase() : 'FR'),
  z.string().length(2, 'Use a 2-letter country code'),
);

/**
 * Shared shape between the create and update forms. Kept as a plain object so
 * `interventionUpdateSchema` can `.extend()` it without duplicating rules.
 */
const interventionFields = {
  customerId: requiredUuid,
  customerAddressId: nullableUuid,
  technicianId: nullableUuid,
  title: requiredText(2, 160, 'Title'),
  description: nullableText(8000, 'Description'),
  internalNotes: nullableText(8000, 'Internal notes'),
  status: interventionStatusSchema.default('draft'),
  priority: interventionPrioritySchema.default('normal'),
  scheduledStart: nullableDateTime,
  scheduledEnd: nullableDateTime,
  /** Optional address override; footers fall back to the customer address. */
  addressLine1: nullableText(160, 'Address'),
  addressLine2: nullableText(160, 'Address line 2'),
  postalCode: nullableText(20, 'Postal code'),
  city: nullableText(80, 'City'),
  country: countryField,
};

const interventionBaseSchema = z.object(interventionFields);

function refineScheduleOrder(
  data: { scheduledStart: string | null; scheduledEnd: string | null },
  ctx: z.RefinementCtx,
) {
  if (
    data.scheduledStart &&
    data.scheduledEnd &&
    new Date(data.scheduledEnd).getTime() < new Date(data.scheduledStart).getTime()
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['scheduledEnd'],
      message: 'End time must be after the start time',
    });
  }
}

export const interventionSchema = interventionBaseSchema.superRefine(refineScheduleOrder);

/** Same rules as the create form, targeting an existing record. */
export const interventionUpdateSchema = interventionBaseSchema
  .extend({ id: requiredUuid })
  .superRefine(refineScheduleOrder);

/** Fast status transition used by the planning board and detail page. */
export const interventionStatusChangeSchema = z.object({
  interventionId: requiredUuid,
  status: interventionStatusSchema,
  completionNotes: nullableText(4000, 'Completion notes'),
});

export const interventionAssignSchema = z.object({
  interventionId: requiredUuid,
  technicianId: nullableUuid,
});

export const interventionPhotoSchema = z.object({
  interventionId: requiredUuid,
  kind: z.enum(['before', 'after']),
  storagePath: z.string().min(3).max(500),
  fileName: nullableText(200, 'File name'),
  mimeType: nullableText(120, 'Content type'),
  sizeBytes: z
    .preprocess((value) => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = Number.parseInt(String(value), 10);
      return Number.isNaN(parsed) ? null : parsed;
    }, z.number().int().min(0).max(20 * 1024 * 1024).nullable())
    .transform((value) => value ?? null),
  caption: nullableText(300, 'Caption'),
});

export const interventionPhotoDeleteSchema = z.object({
  photoId: requiredUuid,
});

export type InterventionInput = z.infer<typeof interventionSchema>;
export type InterventionUpdateInput = z.infer<typeof interventionUpdateSchema>;

export type InterventionStatusChangeInput = z.infer<typeof interventionStatusChangeSchema>;
export type InterventionPhotoInput = z.infer<typeof interventionPhotoSchema>;
