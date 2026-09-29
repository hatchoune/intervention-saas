import Link from 'next/link';
import { Mail, MapPin, Pencil, Phone } from 'lucide-react';

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
import type { CustomerRow } from '@/types/database';

export interface CustomerTableProps {
  rows: CustomerRow[];
  /** Managers get the inline edit shortcut. */
  canManage: boolean;
}

function addressLine(row: CustomerRow): string {
  return [row.address_line1, [row.postal_code, row.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(' · ');
}

export function CustomerTable({ rows, canManage }: CustomerTableProps) {
  return (
    <TableWrapper>
      <Table>
        <TableHead>
          <TableRow className="hover:bg-transparent">
            <TableHeaderCell>Customer</TableHeaderCell>
            <TableHeaderCell>Type</TableHeaderCell>
            <TableHeaderCell>Contact</TableHeaderCell>
            <TableHeaderCell>Address</TableHeaderCell>
            <TableHeaderCell>Tags</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell className="text-right">Actions</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="max-w-[18rem]">
                <Link
                  href={`/customers/${row.id}`}
                  className="block truncate font-medium text-indigo-700 hover:underline"
                >
                  {row.name}
                </Link>
                {row.type === 'company' && row.contact_name ? (
                  <p className="truncate text-xs text-slate-500">Contact: {row.contact_name}</p>
                ) : null}
                {row.vat_number ? (
                  <p className="truncate text-xs text-slate-500">VAT {row.vat_number}</p>
                ) : null}
              </TableCell>
              <TableCell>
                <Badge tone={row.type === 'company' ? 'accent' : 'info'}>
                  {row.type === 'company' ? 'Company' : 'Individual'}
                </Badge>
              </TableCell>
              <TableCell className="min-w-[13rem]">
                {row.email ? (
                  <a
                    href={`mailto:${row.email}`}
                    className="flex items-center gap-1.5 text-slate-700 hover:text-indigo-700"
                  >
                    <Mail aria-hidden className="size-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{row.email}</span>
                  </a>
                ) : null}
                {row.phone ?? row.mobile ? (
                  <a
                    href={`tel:${row.phone ?? row.mobile}`}
                    className="flex items-center gap-1.5 text-slate-700 hover:text-indigo-700"
                  >
                    <Phone aria-hidden className="size-3.5 shrink-0 text-slate-400" />
                    <span className="whitespace-nowrap">{row.phone ?? row.mobile}</span>
                  </a>
                ) : null}
                {!row.email && !row.phone && !row.mobile ? (
                  <span className="text-slate-400">—</span>
                ) : null}
              </TableCell>
              <TableCell className="max-w-[16rem]">
                {addressLine(row) ? (
                  <span className="flex items-start gap-1.5 text-slate-600">
                    <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
                    <span className="line-clamp-2">{addressLine(row)}</span>
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </TableCell>
              <TableCell>
                {row.tags.length === 0 ? (
                  <span className="text-slate-400">—</span>
                ) : (
                  <span className="flex flex-wrap gap-1">
                    {row.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} tone="neutral">
                        {tag}
                      </Badge>
                    ))}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <Badge tone={row.status === 'active' ? 'success' : 'neutral'}>
                  {row.status === 'active' ? 'Active' : 'Archived'}
                </Badge>
              </TableCell>
              <TableCell className="text-right whitespace-nowrap">
                <Link
                  href={`/customers/${row.id}`}
                  className="text-sm font-medium text-indigo-700 hover:underline"
                >
                  View
                </Link>
                {canManage ? (
                  <Link
                    href={`/customers/${row.id}/edit`}
                    className="ml-3 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline"
                  >
                    <Pencil aria-hidden className="size-3.5" />
                    Edit
                  </Link>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableWrapper>
  );
}
