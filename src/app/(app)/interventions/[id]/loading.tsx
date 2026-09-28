import { CardSkeleton, Skeleton } from '@/components/ui/empty-state';

/** Route-level loading UI for the intervention detail page. */
export default function InterventionDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <Skeleton className="h-4 w-36" />

      <div className="space-y-2">
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="flex gap-2">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-28 rounded-full" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="space-y-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    </div>
  );
}
