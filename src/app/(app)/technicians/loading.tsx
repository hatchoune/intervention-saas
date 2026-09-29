import { CardSkeleton, Skeleton } from '@/components/ui/empty-state';

/** Mirrors the technician list layout: header, filter card, table. */
export default function LoadingTechnicians() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6" role="status" aria-label="Loading">
      <div className="space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <CardSkeleton />
      <CardSkeleton />
      <span className="sr-only">Loading technicians…</span>
    </div>
  );
}
