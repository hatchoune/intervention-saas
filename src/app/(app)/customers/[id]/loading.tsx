import { CardSkeleton, Skeleton } from '@/components/ui/empty-state';

/** Mirrors the customer detail layout: header with actions, stats, two columns. */
export default function LoadingCustomer() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6" role="status" aria-label="Loading">
      <Skeleton className="h-3 w-32" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-60" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <CardSkeleton />
      </div>
      <span className="sr-only">Loading customer…</span>
    </div>
  );
}
