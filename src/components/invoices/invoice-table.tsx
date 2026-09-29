import Link from 'next/link';
import { Pencil } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableWrapper,
} from '@/components/ui/table';
import type { InvoiceListItem } from '@/lib/db/invoices';
import { INVOICE_STATUS_META } from '@/lib/domain/status';
import { formatCurrency, formatDate } from '@/lib/utils/format';

export interface InvoiceTableProps {
  rows: InvoiceListItem[];
  canManage: boolean;
  currency: string;
}

export function InvoiceTable({ rows, canManage, currency }: InvoiceTableProps) {
  return (
    <TableWrapper>
      <Table>
        <TableHead>
          <TableRow className="hover:bg-transparent">
            <TableHeaderCell>Invoice</TableHeaderCell>
            <TableHeaderCell>Customer</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Issued</TableHeaderCell>
            <TableHeaderCell>Due</TableHeaderCell>
            <TableHeaderCell className="text-right">Total</TableHeaderCell>
            <TableHeaderCell className="text-right">Balance</TableHeaderCell>
            <TableHeaderCell className="text-right">Actions</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const meta = INVOICE_STATUS_META[row.effectiveStatus];
            const money = row.currency || currency;
            return (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap">
                  <Link
                    href={`/invoices/${row.id}`}
                    className="font-medium text-indigo-700 hover:underline"
                  >
                    {row.invoice_number}
                  </Link>
                </TableCell>
                <TableCell className="max-w-[15rem]">
                  {row.customer ? (
                    <Link
                      href={`/customers/${row.customer.id}`}
                      className="block truncate hover:text-indigo-700 hover:underline"
                    >
                      {row.customer.name}
                    </Link>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-slate-600">
                  {formatDate(row.issue_date)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-slate-600">
                  {row.due_date ? formatDate(row.due_date) : '—'}
                </TableCell>
                <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                  {formatCurrency(row.total, money)}
                </TableCell>
                <TableCell
                  className={
                    row.balance > 0
                      ? 'text-right font-medium whitespace-nowrap tabular-nums text-amber-700'
                      : 'text-right whitespace-nowrap tabular-nums text-slate-500'
                  }
                >
                  {formatCurrency(row.balance, money)}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Link
                    href={`/invoices/${row.id}`}
                    className="text-sm font-medium text-indigo-700 hover:underline"
                  >
                    View
                  </Link>
                  {canManage && row.status === 'draft' ? (
                    <Link
                      href={`/invoices/${row.id}/edit`}
                      className="ml-3 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline"
                    >
                      <Pencil aria-hidden className="size-3.5" />
                      Edit
                    </Link>
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableWrapper>
  );
}
