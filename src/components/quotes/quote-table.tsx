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
import type { QuoteListItem } from '@/lib/db/quotes';
import { QUOTE_STATUS_META } from '@/lib/domain/status';
import { formatCurrency, formatDate } from '@/lib/utils/format';

export interface QuoteTableProps {
  rows: QuoteListItem[];
  canManage: boolean;
  currency: string;
}

export function QuoteTable({ rows, canManage, currency }: QuoteTableProps) {
  return (
    <TableWrapper>
      <Table>
        <TableHead>
          <TableRow className="hover:bg-transparent">
            <TableHeaderCell>Quote</TableHeaderCell>
            <TableHeaderCell>Customer</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Issued</TableHeaderCell>
            <TableHeaderCell>Valid until</TableHeaderCell>
            <TableHeaderCell className="text-right">Total</TableHeaderCell>
            <TableHeaderCell className="text-right">Actions</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const meta = QUOTE_STATUS_META[row.status];
            return (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap">
                  <Link
                    href={`/quotes/${row.id}`}
                    className="font-medium text-indigo-700 hover:underline"
                  >
                    {row.quote_number}
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
                  {row.converted_invoice_id ? (
                    <span className="text-xs text-slate-400">Invoiced</span>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-slate-600">
                  {formatDate(row.issue_date)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-slate-600">
                  {row.valid_until ? formatDate(row.valid_until) : '—'}
                </TableCell>
                <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                  {formatCurrency(row.total, row.currency || currency)}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Link
                    href={`/quotes/${row.id}`}
                    className="text-sm font-medium text-indigo-700 hover:underline"
                  >
                    View
                  </Link>
                  {canManage && row.status !== 'accepted' ? (
                    <Link
                      href={`/quotes/${row.id}/edit`}
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
