import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableWrapper,
} from '@/components/ui/table';
import { formatCurrency, formatNumber } from '@/lib/utils/format';

/**
 * Read-only line item table for quote / invoice detail pages. The amounts are
 * the trigger-computed columns, so what is shown is exactly what was billed.
 */

export interface DocumentItemLine {
  id: string;
  position: number;
  description: string;
  unit: string;
  quantity: number | string;
  unit_price: number | string;
  vat_rate: number | string;
  discount_percent: number | string;
  line_discount: number | string;
  line_total: number | string;
}

export interface DocumentItemsTableProps {
  items: DocumentItemLine[];
  currency: string;
}

export function DocumentItemsTable({ items, currency }: DocumentItemsTableProps) {
  return (
    <TableWrapper>
      <Table>
        <TableHead>
          <TableRow className="hover:bg-transparent">
            <TableHeaderCell className="w-10">#</TableHeaderCell>
            <TableHeaderCell>Description</TableHeaderCell>
            <TableHeaderCell>Unit</TableHeaderCell>
            <TableHeaderCell className="text-right">Qty</TableHeaderCell>
            <TableHeaderCell className="text-right">Unit price</TableHeaderCell>
            <TableHeaderCell className="text-right">Line disc.</TableHeaderCell>
            <TableHeaderCell className="text-right">VAT</TableHeaderCell>
            <TableHeaderCell className="text-right">Total (inc. VAT)</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => {
            const discount = Number(item.discount_percent);
            return (
              <TableRow key={item.id}>
                <TableCell className="text-slate-400">{item.position}</TableCell>
                <TableCell className="max-w-[22rem]">
                  <span className="line-clamp-2">{item.description}</span>
                  {discount > 0 ? (
                    <span className="text-xs text-slate-500">
                      −{formatCurrency(Number(item.line_discount), currency)} line discount
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="whitespace-nowrap text-slate-600">{item.unit}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(Number(item.quantity))}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(Number(item.unit_price), currency)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {discount > 0 ? `${formatNumber(discount)}%` : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(Number(item.vat_rate))}%
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCurrency(Number(item.line_total), currency)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableWrapper>
  );
}
