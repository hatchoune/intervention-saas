import { describe, expect, it } from 'vitest';

import {
  computeDocumentTotals,
  computeLine,
  computeVatBreakdown,
  paymentRatio,
  remainingBalance,
  round2,
} from '@/lib/domain/totals';

/**
 * These expectations mirror the SQL implementation in
 * `supabase/migrations/20250101000007_quotes.sql`. If you change one, change
 * both — a mismatch means the UI preview and the stored totals diverge.
 */
describe('round2', () => {
  it('rounds half away from zero at 2 decimals', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
    expect(round2(-1.005)).toBe(-1.01);
    expect(round2(0)).toBe(0);
  });

  it('never returns NaN for invalid input', () => {
    expect(round2(Number.NaN)).toBe(0);
    expect(round2(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('computeLine', () => {
  it('computes a simple line', () => {
    const line = computeLine({ quantity: 2, unitPrice: 50, vatRate: 20, discountPercent: 0 });
    expect(line).toEqual({
      lineSubtotal: 100,
      lineDiscount: 0,
      lineTotal: 100,
      lineVat: 20,
    });
  });

  it('applies a line discount before VAT', () => {
    const line = computeLine({ quantity: 1, unitPrice: 100, vatRate: 20, discountPercent: 10 });
    expect(line.lineSubtotal).toBe(100);
    expect(line.lineDiscount).toBe(10);
    expect(line.lineTotal).toBe(90);
    expect(line.lineVat).toBe(18);
  });

  it('handles decimal quantities (hours)', () => {
    const line = computeLine({ quantity: 2.5, unitPrice: 48.5, vatRate: 20, discountPercent: 0 });
    expect(line.lineSubtotal).toBe(121.25);
    expect(line.lineVat).toBe(24.25);
  });

  it('clamps negative and out-of-range inputs', () => {
    expect(computeLine({ quantity: -1, unitPrice: 100, vatRate: 20, discountPercent: 0 }).lineSubtotal).toBe(0);
    // VAT rate is clamped to 100%
    expect(computeLine({ quantity: 1, unitPrice: 100, vatRate: 120, discountPercent: 0 }).lineVat).toBe(100);
    expect(
      computeLine({ quantity: 1, unitPrice: 100, vatRate: 20, discountPercent: 150 }).lineTotal,
    ).toBe(0);
  });

  it('tolerates strings coming from form inputs', () => {
    const line = computeLine({
      quantity: '3' as unknown as number,
      unitPrice: '10.50' as unknown as number,
      vatRate: '20' as unknown as number,
      discountPercent: '0' as unknown as number,
    });
    expect(line.lineSubtotal).toBe(31.5);
  });
});

describe('computeDocumentTotals', () => {
  const lines = [
    { quantity: 10, unitPrice: 45, vatRate: 20, discountPercent: 0 },
    { quantity: 2, unitPrice: 120.5, vatRate: 10, discountPercent: 10 },
  ];

  it('sums subtotal, discounts, net and VAT', () => {
    const totals = computeDocumentTotals(lines);
    // 450 + 241 = 691 subtotal, line discount 24.10 -> 666.90 net
    expect(totals.subtotal).toBe(691);
    expect(totals.discountTotal).toBe(24.1);
    expect(totals.netTotal).toBe(666.9);
    // VAT: 450 * 20% = 90 ; 216.90 * 10% = 21.69 -> 111.69
    expect(totals.vatTotal).toBe(111.69);
    expect(totals.total).toBe(778.59);
  });

  it('applies a global percentage discount and reduces VAT proportionally', () => {
    const totals = computeDocumentTotals(lines, 'percentage', 10);
    expect(totals.netTotal).toBe(600.21);
    expect(totals.discountTotal).toBe(90.79);
    // 666.90 * 0.9 = 600.21 -> VAT 111.69 * 0.9 = 100.52
    expect(totals.vatTotal).toBe(100.52);
    expect(totals.total).toBe(700.73);
  });

  it('caps a fixed global discount at the net total', () => {
    const totals = computeDocumentTotals(lines, 'fixed', 5000);
    expect(totals.netTotal).toBe(0);
    expect(totals.vatTotal).toBe(0);
    expect(totals.total).toBe(0);
    expect(totals.discountTotal).toBe(691);
  });

  it('ignores a discount of type none', () => {
    const totals = computeDocumentTotals(lines, 'none', 42);
    expect(totals.discountTotal).toBe(24.1);
  });

  it('returns zeroes for an empty document', () => {
    expect(computeDocumentTotals([])).toEqual({
      subtotal: 0,
      discountTotal: 0,
      netTotal: 0,
      vatTotal: 0,
      total: 0,
    });
  });

  it('is not affected by floating point drift on awkward values', () => {
    const totals = computeDocumentTotals([
      { quantity: 3, unitPrice: 0.1, vatRate: 20, discountPercent: 0 },
      { quantity: 7, unitPrice: 0.29, vatRate: 20, discountPercent: 33.33 },
    ]);
    expect(totals.subtotal).toBe(2.33);
    // 0.30 + (2.03 - 0.68) = 1.65 in both JS and PostgreSQL
    expect(totals.netTotal).toBe(1.65);
  });
});

describe('computeVatBreakdown', () => {
  it('groups base amounts per VAT rate and rescales after a global discount', () => {
    const breakdown = computeVatBreakdown(
      [
        { quantity: 1, unitPrice: 100, vatRate: 20, discountPercent: 0 },
        { quantity: 1, unitPrice: 100, vatRate: 10, discountPercent: 0 },
      ],
      'percentage',
      50,
    );

    expect(breakdown).toEqual([
      { vatRate: 10, base: 50, vat: 5 },
      { vatRate: 20, base: 50, vat: 10 },
    ]);
  });
});

describe('invoice payment helpers', () => {
  it('computes the remaining balance without going negative', () => {
    expect(remainingBalance(1200, 200)).toBe(1000);
    expect(remainingBalance(1200, 1500)).toBe(0);
    expect(remainingBalance(0, 0)).toBe(0);
  });

  it('computes a clamped payment ratio', () => {
    expect(paymentRatio(1000, 250)).toBe(0.25);
    expect(paymentRatio(1000, 2000)).toBe(1);
    expect(paymentRatio(0, 100)).toBe(0);
  });
});
