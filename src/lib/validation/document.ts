import { z } from 'zod';

import type { DiscountType } from '@/types/database';
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
  // Normalised to `null` so the editor's `EditableLine` shape and the sync
  // helpers always see an explicit value instead of `undefined`.
  id: z.uuid().nullish().transform((value) => value ?? null),
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

/**
 * Line items arrive from the form as one JSON string: a nested array cannot be
 * expressed with plain `FormData` names, and a hidden JSON field keeps the
 * payload a single, validated value instead of dozens of indexed keys.
 */
export const documentLinesField = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}, documentLinesSchema);

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

function refineQuoteDates(
  data: { issueDate: string; validUntil: string | null; discountType: DiscountType; discountValue: number },
  ctx: z.RefinementCtx,
): void {
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
}

const quoteFields = {
  status: quoteStatusSchema.default('draft'),
  validUntil: nullableDate,
};

export const quoteSchema = documentBaseSchema
  .extend({ ...quoteFields, lines: documentLinesSchema })
  .superRefine(refineQuoteDates);

/** Same rules as `quoteSchema`, with the line items coming from a form. */
export const quoteFormSchema = documentBaseSchema
  .extend({ ...quoteFields, lines: documentLinesField })
  .superRefine(refineQuoteDates);

function refineInvoiceDates(
  data: { issueDate: string; dueDate: string | null },
  ctx: z.RefinementCtx,
): void {
  if (data.dueDate && data.dueDate < data.issueDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['dueDate'],
      message: 'The due date must be after the issue date',
    });
  }
}

const invoiceFields = {
  status: invoiceStatusSchema.default('draft'),
  dueDate: nullableDate,
  amountPaid: decimalNumber({ label: 'Amount paid', min: 0, max: 10_000_000, defaultValue: 0 }),
  paymentMethod: nullableText(60, 'Payment method'),
  paymentTerms: nullableText(300, 'Payment terms'),
};

export const invoiceSchema = documentBaseSchema
  .extend({ ...invoiceFields, lines: documentLinesSchema })
  .superRefine(refineInvoiceDates);

/** Same rules as `invoiceSchema`, with the line items coming from a form. */
export const invoiceFormSchema = documentBaseSchema
  .extend({ ...invoiceFields, lines: documentLinesField })
  .superRefine(refineInvoiceDates);

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

/** Targeted mutations on an existing quote / invoice. */
export const quoteIdSchema = z.object({ quoteId: requiredUuid });
export const invoiceIdSchema = z.object({ invoiceId: requiredUuid });

export type QuoteInput = z.infer<typeof quoteSchema>;
export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type DocumentLineInput = z.infer<typeof documentLineSchema>;
export type InvoicePaymentInput = z.infer<typeof invoicePaymentSchema>;

export type QuoteFormInput = z.infer<typeof quoteFormSchema>;
export type InvoiceFormInput = z.infer<typeof invoiceFormSchema>;

/** Shape of a line as sent back to the client editor. */
export interface EditableLine {
  id: string | null;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  discountPercent: number;
}

export function toEditableLines(
  rows: readonly {
    id: string;
    description: string;
    unit: string;
    quantity: number | string;
    unit_price: number | string;
    vat_rate: number | string;
    discount_percent: number | string;
  }[],
): EditableLine[] {
  return rows.map((row) => ({
    id: row.id,
    description: row.description,
    unit: row.unit,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    vatRate: Number(row.vat_rate),
    discountPercent: Number(row.discount_percent),
  }));
}
