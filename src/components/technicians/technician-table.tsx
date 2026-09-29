import Link from 'next/link';
import { Pencil } from 'lucide-react';

import { TechnicianStatusControl } from '@/components/technicians/technician-status-control';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/data-display';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableWrapper,
} from '@/components/ui/table';
import type { TechnicianListItem } from '@/lib/db/technicians';
import { TECHNICIAN_STATUS_META } from '@/lib/domain/status';
import { formatCurrency } from '@/lib/utils/format';

export interface TechnicianTableProps {
  rows: TechnicianListItem[];
  /** Managers get the inline availability select and the edit shortcut. */
  canManage: boolean;
  /** Set for the technician's own row so it can change its availability. */
  currentUserId: string;
}

export function TechnicianTable({ rows, canManage, currentUserId }: TechnicianTableProps) {
  return (
    <TableWrapper>
      <Table>
        <TableHead>
          <TableRow className="hover:bg-transparent">
            <TableHeaderCell>Technician</TableHeaderCell>
            <TableHeaderCell>Skills</TableHeaderCell>
            <TableHeaderCell>Phone</TableHeaderCell>
            <TableHeaderCell>Open work</TableHeaderCell>
            <TableHeaderCell>Rate</TableHeaderCell>
            <TableHeaderCell>Availability</TableHeaderCell>
            <TableHeaderCell className="text-right">Actions</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const mayEditStatus = canManage || row.user_id === currentUserId;

            return (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar name={row.full_name} color={row.color} size="md" />
                    <div className="min-w-0">
                      <Link
                        href={`/technicians/${row.id}`}
                        className="block truncate font-medium text-indigo-700 hover:underline"
                      >
                        {row.full_name}
                      </Link>
                      <p className="truncate text-xs text-slate-500">
                        {row.job_title ?? 'Technician'}
                        {row.is_active ? '' : ' · inactive'}
                        {row.user_id ? ' · linked login' : ''}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="max-w-[14rem]">
                  {row.skills.length === 0 ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {row.skills.slice(0, 3).map((skill) => (
                        <Badge key={skill} tone="neutral">
                          {skill}
                        </Badge>
                      ))}
                      {row.skills.length > 3 ? (
                        <Badge tone="neutral">+{row.skills.length - 3}</Badge>
                      ) : null}
                    </span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-slate-600">
                  {row.phone ?? <span className="text-slate-400">—</span>}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className="font-medium tabular-nums text-slate-800">{row.load.open}</span>
                  <span className="ml-1 text-xs text-slate-500">
                    open
                    {row.load.today > 0 ? ` · ${row.load.today} today` : ''}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums text-slate-600">
                  {row.hourly_rate === null ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    `${formatCurrency(row.hourly_rate)}/h`
                  )}
                </TableCell>
                <TableCell>
                  {mayEditStatus ? (
                    <TechnicianStatusControl technicianId={row.id} status={row.status} />
                  ) : (
                    <Badge tone={TECHNICIAN_STATUS_META[row.status].tone}>
                      {TECHNICIAN_STATUS_META[row.status].label}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Link
                    href={`/technicians/${row.id}`}
                    className="text-sm font-medium text-indigo-700 hover:underline"
                  >
                    View
                  </Link>
                  {canManage ? (
                    <Link
                      href={`/technicians/${row.id}/edit`}
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
