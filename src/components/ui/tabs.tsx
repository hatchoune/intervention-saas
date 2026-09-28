import Link from 'next/link';

import { cn } from '@/lib/utils/cn';

export interface TabItem {
  label: string;
  href: string;
  count?: number;
  /** Marks the tab as the current one. */
  active: boolean;
}

/**
 * Link based tabs: each tab is a real URL so tabs are shareable, work without
 * JavaScript, and can be rendered entirely on the server.
 */
export function LinkTabs({ items, className, ariaLabel = 'Sections' }: {
  items: TabItem[];
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        'flex gap-1 overflow-x-auto border-b border-slate-200 print-hidden',
        className,
      )}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? 'page' : undefined}
          className={cn(
            '-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
            item.active
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800',
          )}
        >
          {item.label}
          {typeof item.count === 'number' ? (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-xs tabular-nums',
                item.active ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600',
              )}
            >
              {item.count}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

/** Segmented control used by the planning views (day / week / list). */
export function SegmentedLinks({ items, className }: { items: TabItem[]; className?: string }) {
  return (
    <div
      role="group"
      className={cn('inline-flex rounded-lg border border-slate-200 bg-white p-0.5 print-hidden', className)}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? 'true' : undefined}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            item.active ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100',
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
