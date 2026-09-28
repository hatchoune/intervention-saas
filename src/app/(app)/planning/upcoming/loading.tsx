import { Card } from '@/components/ui/card';
import { CardSkeleton, Skeleton } from '@/components/ui/empty-state';

/** Route-level loading UI for the upcoming work view. */
export default function PlanningUpcomingLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>

      <Skeleton className="h-9 w-56 rounded-lg" />

      <Card className="p-4">
        <Skeleton className="h-10 w-full" />
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>

      <div className="space-y-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
