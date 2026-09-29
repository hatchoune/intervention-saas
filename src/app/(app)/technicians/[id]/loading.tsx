import { CardSkeleton, Skeleton } from '@/components/ui/empty-state';

/** Mirrors the technician detail layout: header, stat row, two columns. */
export default function LoadingTechnician() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6" role="status" aria-label="Loading">
      <Skeleton className="h-3 w-32" />
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
      <span className="sr-only">Loading technician…</span>
    </div>
  );
}
