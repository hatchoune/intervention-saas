'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/controls';
import { cn } from '@/lib/utils/cn';
import { COMMON_VAT_RATES, LINE_UNITS } from '@/lib/domain/status';
import { formatCurrency } from '@/lib/utils/format';
import type { EditableLine } from '@/lib/validation/document';

/**
 * Line item editor shared by the quote and invoice forms.
 *
 * The rows are kept as raw strings while typing (so "12," stays editable) and
 * serialised into a single hidden `lines` JSON field on every change — the
 * server validates the payload with `documentLinesField`. All amounts shown
 * here are indicative: the database triggers are the source of truth for the
 * `line_*` columns and the document totals.
 */

interface DraftLine {
  key: number;
  id: string | null;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  vatRate: string;
  discountPercent: string;
}

let lineCounter = 0;

function toDraft(line: EditableLine): DraftLine {
  lineCounter += 1;
  return {
    key: lineCounter,
    id: line.id,
    description: line.description,
    unit: line.unit,
    quantity: String(line.quantity),
    unitPrice: String(line.unitPrice),
    vatRate: String(line.vatRate),
    discountPercent: String(line.discountPercent),
  };
}

function emptyLine(): DraftLine {
  return toDraft({
    id: null,
    description: '',
    unit: 'unit',
    quantity: 1,
    unitPrice: 0,
    vatRate: 20,
    discountPercent: 0,
  });
}

/** Accepts both `12.5` and `12,5` (French keyboards). */
function parseAmount(value: string): number {
  const parsed = Number.parseFloat(value.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function lineNet(line: DraftLine): number {
  const gross = parseAmount(line.quantity) * parseAmount(line.unitPrice);
  return gross * (1 - parseAmount(line.discountPercent) / 100);
}

export interface LineItemEditorProps {
  defaultValue: EditableLine[];
  currency: string;
  /** Validation message for the whole `lines` field. */
  error?: string;
  name?: string;
}

export function LineItemEditor({
  defaultValue,
  currency,
  error,
  name = 'lines',
}: LineItemEditorProps) {
  const [lines, setLines] = useState<DraftLine[]>(() =>
    defaultValue.length > 0 ? defaultValue.map(toDraft) : [emptyLine()],
  );

  const payload = JSON.stringify(
    lines.map((line) => ({
      id: line.id,
      description: line.description.trim(),
      unit: line.unit.trim() || 'unit',
      quantity: parseAmount(line.quantity),
      unitPrice: parseAmount(line.unitPrice),
      vatRate: parseAmount(line.vatRate),
      discountPercent: parseAmount(line.discountPercent),
    })),
  );

  function update(key: number, patch: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  const netSubtotal = lines.reduce((sum, line) => sum + lineNet(line), 0);

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={payload} />
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Line items</h3>
          {error ? (
            <p role="alert" className="text-xs font-medium text-rose-600">
              {error}
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              Totals (global discount and VAT included) are recalculated when you save.
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setLines((current) => [...current, emptyLine()])}
        >
          <Plus aria-hidden className="size-4" />
          Add line
        </Button>
      </div>

      <div className="space-y-3">
        {lines.map((line, index) => (
          <div
            key={line.key}
            className={cn(
              'rounded-lg border border-slate-200 bg-slate-50/60 p-3',
              error && 'border-rose-300',
            )}
          >
            <div className="grid gap-2.5 sm:grid-cols-12">
              <Field
                htmlFor={`line-description-${line.key}`}
                label={`Line ${index + 1} — description`}
                className="sm:col-span-12"
              >
                <Input
                  id={`line-description-${line.key}`}
                  value={line.description}
                  required
                  maxLength={500}
                  placeholder="Boiler service — labour"
                  onChange={(event) => update(line.key, { description: event.target.value })}
                />
              </Field>

              <Field htmlFor={`line-unit-${line.key}`} label="Unit" className="sm:col-span-3">
                <Select
                  id={`line-unit-${line.key}`}
                  value={line.unit}
                  onChange={(event) => update(line.key, { unit: event.target.value })}
                >
                  {!LINE_UNITS.includes(line.unit as (typeof LINE_UNITS)[number]) ? (
                    <option value={line.unit}>{line.unit}</option>
                  ) : null}
                  {LINE_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field htmlFor={`line-qty-${line.key}`} label="Qty" className="sm:col-span-2">
                <Input
                  id={`line-qty-${line.key}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={line.quantity}
                  onChange={(event) => update(line.key, { quantity: event.target.value })}
                />
              </Field>
              <Field
                htmlFor={`line-price-${line.key}`}
                label="Unit price"
                className="sm:col-span-3"
              >
                <Input
                  id={`line-price-${line.key}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={line.unitPrice}
                  onChange={(event) => update(line.key, { unitPrice: event.target.value })}
                />
              </Field>

              <Field htmlFor={`line-vat-${line.key}`} label="VAT %" className="sm:col-span-2">
                <Input
                  id={`line-vat-${line.key}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step="0.01"
                  list="line-vat-rates"
                  value={line.vatRate}
                  onChange={(event) => update(line.key, { vatRate: event.target.value })}
                />
              </Field>

              <Field
                htmlFor={`line-discount-${line.key}`}
                label="Disc. %"
                className="sm:col-span-2"
              >
                <Input
                  id={`line-discount-${line.key}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step="0.01"
                  value={line.discountPercent}
                  onChange={(event) => update(line.key, { discountPercent: event.target.value })}
                />
              </Field>

              <div className="sm:col-span-9 sm:col-start-1">
                <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Line total (excl. VAT)
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800">
                  {formatCurrency(lineNet(line), currency)}
                </p>
              </div>

              <div className="flex items-end justify-end sm:col-span-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={lines.length <= 1}
                  aria-label={`Remove line ${index + 1}`}
                  className="text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:hover:bg-transparent disabled:hover:text-slate-500"
                  onClick={() =>
                    setLines((current) => current.filter((item) => item.key !== line.key))
                  }
                >
                  <Trash2 aria-hidden className="size-4" />
                  Remove
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <datalist id="line-vat-rates">
        {COMMON_VAT_RATES.map((rate) => (
          <option key={rate} value={rate} />
        ))}
      </datalist>

      <div className="flex items-baseline justify-between gap-4 border-t border-slate-200 pt-3 text-sm">
        <span className="text-slate-500">
          Net subtotal ({lines.length} {lines.length === 1 ? 'line' : 'lines'}, before global
          discount and VAT)
        </span>
        <span className="font-semibold tabular-nums text-slate-900">
          {formatCurrency(netSubtotal, currency)}
        </span>
      </div>
    </div>
  );
}
