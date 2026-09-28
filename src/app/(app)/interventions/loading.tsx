import { Card } from '@/components/ui/card';
import { CardSkeleton, Skeleton, TableSkeleton } from '@/components/ui/empty-state';

/** Route-level loading UI for the interventions list. */
export default function InterventionsLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-44" />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <TableSkeleton rows={6} />
      </Card>

      <CardSkeleton />
    </div>
  );
}
