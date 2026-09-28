import { Card } from '@/components/ui/card';
import { CardSkeleton, Skeleton } from '@/components/ui/empty-state';

/** Route-level loading UI for the planning week view. */
export default function PlanningWeekLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-80" />
      </div>

      <Skeleton className="h-9 w-56 rounded-lg" />

      <Card className="space-y-4 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-64" />
      </Card>

      <div className="table-scroll w-full">
        <div className="grid min-w-[64rem] grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
