import { z } from 'zod';

import {
  decimalNumber,
  nullableDate,
  nullableText,
  requiredDate,
  requiredUuid,
} from '@/lib/validation/common';

export const quoteStatusSchema = z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired']);
export const invoiceStatusSchema = z.enum([
  'draft',
  'sent',
  'partial',
  'paid',
  'overdue',
  'cancelled',
]);
export const discountTypeSchema = z.enum(['none', 'percentage', 'fixed']);

/**
 * A line item as submitted by the line item editor. `quantity`, `unitPrice`,
 * `vatRate` and `discountPercent` are validated here; the derived amounts
 * (`lineTotal`, VAT) are always recomputed by the database triggers.
 */
export const documentLineSchema = z.object({
  id: z.uuid().nullish(),
  description: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z.string({ error: 'Description is required' }).min(1, 'Description is required').max(500),
  ),
  unit: z
    .preprocess(
      (value) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : 'unit'),
      z.string().min(1).max(30),
    )
    .default('unit'),
  quantity: decimalNumber({ label: 'Quantity', min: 0, max: 1_000_000, defaultValue: 1 }),
  unitPrice: decimalNumber({ label: 'Unit price', min: 0, max: 10_000_000, defaultValue: 0 }),
  vatRate: decimalNumber({ label: 'VAT rate', min: 0, max: 100, defaultValue: 20 }),
  discountPercent: decimalNumber({
    label: 'Line discount',
    min: 0,
    max: 100,
    defaultValue: 0,
  }),
});

export const documentLinesSchema = z
  .array(documentLineSchema)
  .min(1, 'Add at least one line item')
  .max(200, 'Too many line items (200 max)');

const documentBaseSchema = z.object({
  customerId: requiredUuid,
  interventionId: z.uuid().nullish().transform((value) => value ?? null),
  issueDate: requiredDate,
  discountType: discountTypeSchema.default('none'),
  discountValue: decimalNumber({
    label: 'Discount',
    min: 0,
    max: 10_000_000,
    defaultValue: 0,
  }),
  notes: nullableText(4000, 'Notes'),
  internalNotes: nullableText(4000, 'Internal notes'),
});

export const quoteSchema = documentBaseSchema
  .extend({
    status: quoteStatusSchema.default('draft'),
    validUntil: nullableDate,
    lines: documentLinesSchema,
  })
  .superRefine((data, ctx) => {
    if (data.validUntil && data.validUntil < data.issueDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['validUntil'],
        message: 'The validity date must be after the issue date',
      });
    }

    if (data.discountType === 'percentage' && data.discountValue > 100) {
      ctx.addIssue({
        code: 'custom',
        path: ['discountValue'],
        message: 'A percentage discount cannot exceed 100%',
      });
    }
  });

export const invoiceSchema = documentBaseSchema
  .extend({
    status: invoiceStatusSchema.default('draft'),
    dueDate: nullableDate,
    amountPaid: decimalNumber({ label: 'Amount paid', min: 0, max: 10_000_000, defaultValue: 0 }),
    paymentMethod: nullableText(60, 'Payment method'),
    paymentTerms: nullableText(300, 'Payment terms'),
    lines: documentLinesSchema,
  })
  .superRefine((data, ctx) => {
    if (data.dueDate && data.dueDate < data.issueDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['dueDate'],
        message: 'The due date must be after the issue date',
      });
    }
  });

export const invoicePaymentSchema = z.object({
  invoiceId: requiredUuid,
  amountPaid: decimalNumber({ label: 'Amount paid', min: 0, max: 10_000_000 }),
  paymentMethod: nullableText(60, 'Payment method'),
});

export const invoiceFromQuoteSchema = z.object({
  quoteId: requiredUuid,
  issueDate: nullableDate,
  dueDate: nullableDate,
});

export const invoiceFromInterventionSchema = z.object({
  interventionId: requiredUuid,
  issueDate: nullableDate,
  dueDate: nullableDate,
});

export const documentStatusChangeSchema = z.object({
  documentId: requiredUuid,
  status: z.string().min(3).max(20),
});

export type QuoteInput = z.infer<typeof quoteSchema>;
export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type DocumentLineInput = z.infer<typeof documentLineSchema>;
export type InvoicePaymentInput = z.infer<typeof invoicePaymentSchema>;
