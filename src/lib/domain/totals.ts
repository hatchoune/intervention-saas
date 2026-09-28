import type { DiscountType } from '@/types/database';

/**
 * Pure money engine.
 *
 * This is the exact mirror of the SQL implementation in
 * `supabase/migrations/20250101000007_quotes.sql`:
 *
 *   line_subtotal = round(quantity * unit_price, 2)
 *   line_discount = round(line_subtotal * discount_percent / 100, 2)
 *   line_total    = line_subtotal - line_discount          (net, excl. VAT)
 *   line_vat      = round(line_total * vat_rate / 100, 2)
 *   net_total     = sum(line_total) - global_discount
 *   vat_total     = round(sum(line_vat) * net_total / sum(line_total), 2)
 *   total         = net_total + vat_total
 *
 * The database is the source of truth when persisting; these functions give an
 * instant, dependency-free preview in the browser and are unit tested.
 */

export interface LineInput {
  quantity: number;
  unitPrice: number;
  vatRate: number;
  discountPercent: number;
}

export interface ComputedLine {
  lineSubtotal: number;
  lineDiscount: number;
  lineTotal: number;
  lineVat: number;
}

export interface DocumentTotals {
  subtotal: number;
  discountTotal: number;
  netTotal: number;
  vatTotal: number;
  total: number;
}

/** Rounds to 2 decimals, half away from zero (mirrors PostgreSQL `round`). */
export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const sign = value < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(value) * 100 + 1e-9)) / 100;
}

function safeNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function computeLine(input: LineInput): ComputedLine {
  const quantity = Math.max(0, safeNumber(input.quantity));
  const unitPrice = Math.max(0, safeNumber(input.unitPrice));
  const vatRate = Math.min(100, Math.max(0, safeNumber(input.vatRate)));
  const discountPercent = Math.min(100, Math.max(0, safeNumber(input.discountPercent)));

  const lineSubtotal = round2(quantity * unitPrice);
  const lineDiscount = round2((lineSubtotal * discountPercent) / 100);
  const lineTotal = round2(lineSubtotal - lineDiscount);
  const lineVat = round2((lineTotal * vatRate) / 100);

  return { lineSubtotal, lineDiscount, lineTotal, lineVat };
}

export function computeDocumentTotals(
  lines: readonly LineInput[],
  discountType: DiscountType = 'none',
  discountValue = 0,
): DocumentTotals {
  let subtotal = 0;
  let itemDiscountTotal = 0;
  let vatSum = 0;
  let netSum = 0;

  for (const line of lines) {
    const computed = computeLine(line);
    subtotal += computed.lineSubtotal;
    itemDiscountTotal += computed.lineDiscount;
    vatSum += computed.lineVat;
    netSum += computed.lineTotal;
  }

  subtotal = round2(subtotal);
  itemDiscountTotal = round2(itemDiscountTotal);
  vatSum = round2(vatSum);
  netSum = round2(netSum);

  const value = Math.max(0, safeNumber(discountValue));
  let globalDiscount = 0;

  if (discountType === 'percentage') {
    globalDiscount = round2((netSum * Math.min(100, value)) / 100);
  } else if (discountType === 'fixed') {
    globalDiscount = round2(Math.min(value, netSum));
  }

  const netTotal = round2(netSum - globalDiscount);
  const vatTotal = netSum > 0 ? round2((vatSum * netTotal) / netSum) : 0;
  const total = round2(netTotal + vatTotal);

  return {
    subtotal,
    discountTotal: round2(itemDiscountTotal + globalDiscount),
    netTotal,
    vatTotal,
    total,
  };
}

/**
 * VAT breakdown per rate, as required on French invoices ("détail de TVA").
 */
export interface VatBreakdownEntry {
  vatRate: number;
  base: number;
  vat: number;
}

export function computeVatBreakdown(
  lines: readonly LineInput[],
  discountType: DiscountType = 'none',
  discountValue = 0,
): VatBreakdownEntry[] {
  const totals = computeDocumentTotals(lines, discountType, discountValue);
  const buckets = new Map<number, number>();

  for (const line of lines) {
    const computed = computeLine(line);
    buckets.set(line.vatRate, round2((buckets.get(line.vatRate) ?? 0) + computed.lineTotal));
  }

  const netSum = [...buckets.values()].reduce((sum, value) => sum + value, 0);

  return [...buckets.entries()]
    .map(([vatRate, bucketNet]) => {
      const base =
        netSum > 0 ? round2((bucketNet * totals.netTotal) / netSum) : round2(buckets.get(vatRate) ?? 0);
      return { vatRate, base, vat: round2((base * vatRate) / 100) };
    })
    .sort((a, b) => a.vatRate - b.vatRate);
}

/** Remaining balance of an invoice. */
export function remainingBalance(total: number, amountPaid: number): number {
  return round2(Math.max(0, safeNumber(total) - safeNumber(amountPaid)));
}

/** Payment progress 0..1 for progress indicators. */
export function paymentRatio(total: number, amountPaid: number): number {
  const safeTotal = safeNumber(total);
  if (safeTotal <= 0) return 0;
  return Math.min(1, Math.max(0, safeNumber(amountPaid) / safeTotal));
}
