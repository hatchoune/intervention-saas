import Link from 'next/link';
import { CalendarClock, Pencil } from 'lucide-react';

import { InterventionPriorityBadge, InterventionStatusBadge } from '@/components/interventions/badges';
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
import type { InterventionListItem } from '@/lib/db/interventions';
import { formatDate, formatTime } from '@/lib/utils/format';

/** Scheduled window rendered as `dd/MM/yyyy · HH:mm–HH:mm`. */
function ScheduleCell({ row }: { row: InterventionListItem }) {
  const start = row.scheduled_start;
  if (!start) {
    return <span className="text-slate-400">Not scheduled</span>;
  }

  const end = row.scheduled_end;

  return (
    <span className="whitespace-nowrap">
      <span className="block font-medium text-slate-800">{formatDate(start)}</span>
      <span className="text-xs text-slate-500 tabular-nums">
        {formatTime(start)}
        {end ? `–${formatTime(end)}` : ''}
      </span>
    </span>
  );
}

export interface InterventionTableProps {
  rows: InterventionListItem[];
  /** Managers get the inline edit shortcut. */
  canManage: boolean;
}

export function InterventionTable({ rows, canManage }: InterventionTableProps) {
  return (
    <TableWrapper>
      <Table>
        <TableHead>
          <TableRow className="hover:bg-transparent">
            <TableHeaderCell>Reference</TableHeaderCell>
            <TableHeaderCell>Title</TableHeaderCell>
            <TableHeaderCell>Customer</TableHeaderCell>
            <TableHeaderCell>City</TableHeaderCell>
            <TableHeaderCell>Schedule</TableHeaderCell>
            <TableHeaderCell>Technician</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Priority</TableHeaderCell>
            <TableHeaderCell className="text-right">Actions</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium whitespace-nowrap">
                <Link
                  href={`/interventions/${row.id}`}
                  className="text-indigo-700 hover:underline"
                >
                  {row.reference}
                </Link>
              </TableCell>
              <TableCell className="max-w-[16rem] min-w-[12rem]">
                <span className="line-clamp-2 text-slate-800">{row.title}</span>
              </TableCell>
              <TableCell className="max-w-[14rem]">
                {row.customer ? (
                  <Link
                    href={`/customers/${row.customer.id}`}
                    className="line-clamp-2 text-slate-700 hover:text-indigo-700 hover:underline"
                  >
                    {row.customer.name}
                  </Link>
                ) : (
                  <span className="text-slate-400">Deleted customer</span>
                )}
              </TableCell>
              <TableCell>{row.city ?? row.customer?.city ?? <span className="text-slate-400">—</span>}</TableCell>
              <TableCell>
                <span className="flex items-center gap-1.5">
                  <CalendarClock aria-hidden className="size-3.5 shrink-0 text-slate-400" />
                  <ScheduleCell row={row} />
                </span>
              </TableCell>
              <TableCell>
                {row.technician ? (
                  <span className="flex items-center gap-2">
                    <Avatar name={row.technician.full_name} color={row.technician.color} size="sm" />
                    <span className="whitespace-nowrap text-slate-700">
                      {row.technician.full_name}
                    </span>
                  </span>
                ) : (
                  <span className="text-xs font-medium text-amber-700">Unassigned</span>
                )}
              </TableCell>
              <TableCell>
                <InterventionStatusBadge status={row.status} />
              </TableCell>
              <TableCell>
                <InterventionPriorityBadge priority={row.priority} withLabel={false} />
              </TableCell>
              <TableCell className="text-right whitespace-nowrap">
                <Link
                  href={`/interventions/${row.id}`}
                  className="text-sm font-medium text-indigo-700 hover:underline"
                >
                  View
                </Link>
                {canManage ? (
                  <Link
                    href={`/interventions/${row.id}/edit`}
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
