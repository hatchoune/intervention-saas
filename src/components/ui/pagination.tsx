import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { buttonClasses } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

export interface PaginationProps {
  page: number;
  perPage: number;
  total: number;
  /** Builds the href for a given page number (keeps current filters). */
  buildHref: (page: number) => string;
  className?: string;
}

export function Pagination({ page, perPage, total, buildHref, className }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  if (total === 0) return null;

  const first = (page - 1) * perPage + 1;
  const last = Math.min(total, page * perPage);

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm print-hidden',
        className,
      )}
    >
      <p className="text-slate-500">
        Showing <span className="font-medium text-slate-700">{first}</span>–
        <span className="font-medium text-slate-700">{last}</span> of{' '}
        <span className="font-medium text-slate-700">{total}</span>
      </p>

      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            href={buildHref(page - 1)}
            rel="prev"
            className={buttonClasses('outline', 'sm')}
            aria-label="Previous page"
          >
            <ChevronLeft aria-hidden className="size-4" />
            Previous
          </Link>
        ) : (
          <span className={cn(buttonClasses('outline', 'sm'), 'pointer-events-none opacity-50')}>
            <ChevronLeft aria-hidden className="size-4" />
            Previous
          </span>
        )}

        <span className="px-1 text-xs text-slate-500">
          Page {page} / {pageCount}
        </span>

        {page < pageCount ? (
          <Link
            href={buildHref(page + 1)}
            rel="next"
            className={buttonClasses('outline', 'sm')}
            aria-label="Next page"
          >
            Next
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        ) : (
          <span className={cn(buttonClasses('outline', 'sm'), 'pointer-events-none opacity-50')}>
            Next
            <ChevronRight aria-hidden className="size-4" />
          </span>
        )}
      </div>
    </nav>
  );
}
