import { cn } from '@/lib/utils/cn';

/**
 * Table primitives. Wrapped in a horizontally scrollable container so wide
 * tables stay usable on phones; the row markup stays server-renderable.
 */
export function TableWrapper({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('table-scroll w-full', className)} {...props} />;
}

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn('w-full min-w-full border-collapse text-left text-sm', className)}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-slate-50 text-xs uppercase tracking-wide text-slate-500', className)} {...props} />;
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-slate-100', className)} {...props} />;
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('transition-colors hover:bg-slate-50/80', className)} {...props} />;
}

export function TableHeaderCell({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={cn('px-4 py-2.5 font-medium', className)} {...props} />;
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3 align-middle text-slate-700', className)} {...props} />;
}

/** Responsive alternative to tables: stacked definition list on mobile. */
export function MetaList({ className, ...props }: React.HTMLAttributes<HTMLDListElement>) {
  return <dl className={cn('grid gap-3 sm:grid-cols-2', className)} {...props} />;
}

export function MetaItem({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm break-words text-slate-800">{children}</dd>
    </div>
  );
}

/** Key/value line used in summaries (totals, payment status…). */
export function SummaryRow({
  label,
  value,
  emphasis,
  className,
}: {
  label: string;
  value: React.ReactNode;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-4 py-1 text-sm',
        emphasis && 'border-t border-slate-200 pt-2 text-base font-semibold text-slate-900',
        className,
      )}
    >
      <span className={cn('text-slate-500', emphasis && 'text-slate-900')}>{label}</span>
      <span className={cn('tabular-nums text-slate-800', emphasis && 'text-slate-900')}>{value}</span>
    </div>
  );
}
