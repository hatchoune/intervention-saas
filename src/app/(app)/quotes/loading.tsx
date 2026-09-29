import { CardSkeleton, Skeleton } from '@/components/ui/empty-state';

/** Mirrors the quote list layout: header, summary cards, filters, table. */
export default function LoadingQuotes() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6" role="status" aria-label="Loading">
      <div className="space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <CardSkeleton />
      <CardSkeleton />
      <span className="sr-only">Loading quotes…</span>
    </div>
  );
}
