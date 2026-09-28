import { z } from 'zod';

import {
  commaSeparatedList,
  decimalNumber,
  hexColor,
  nullableEmail,
  nullablePhone,
  nullableText,
  nullableUuid,
  requiredText,
} from '@/lib/validation/common';

export const technicianStatusSchema = z.enum(['available', 'busy', 'on_leave', 'inactive']);

export const technicianSchema = z.object({
  fullName: requiredText(2, 120, 'Full name'),
  email: nullableEmail('E-mail'),
  phone: nullablePhone('Phone'),
  jobTitle: nullableText(80, 'Job title'),
  skills: commaSeparatedList,
  status: technicianStatusSchema.default('available'),
  color: hexColor.default('#2563eb'),
  hourlyRate: z
    .preprocess(
      (value) => {
        if (value === null || value === undefined || value === '') return null;
        if (typeof value === 'number') return value;
        if (typeof value !== 'string') return value;
        const parsed = Number.parseFloat(value.replace(/\s/g, '').replace(',', '.'));
        return Number.isNaN(parsed) ? value : parsed;
      },
      z.number().finite().min(0, 'Hourly rate cannot be negative').max(100000).nullable(),
    )
    .transform((value) => value ?? null),
  userId: nullableUuid,
  notes: nullableText(2000, 'Notes'),
  isActive: z.preprocess(
    (value) => value === undefined || value === 'on' || value === 'true' || value === true,
    z.boolean(),
  ),
});

/** Inline status change from the technician list (own record). */
export const technicianStatusUpdateSchema = z.object({
  technicianId: z.uuid('Invalid technician'),
  status: technicianStatusSchema,
});

/** Availability override where a numeric value is not allowed. */
export const technicianRateSchema = decimalNumber({
  label: 'Hourly rate',
  min: 0,
  max: 100000,
  defaultValue: 0,
});

export type TechnicianInput = z.infer<typeof technicianSchema>;
