import Link from 'next/link';
import { Compass } from 'lucide-react';

import { buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-xl items-center px-4">
      <div className="w-full">
        <EmptyState
          icon={<Compass aria-hidden className="size-5" />}
          title="Page not found"
          description="This page has moved, or the record you were looking for no longer exists."
          action={
            <Link href="/dashboard" className={buttonClasses('primary', 'md')}>
              Back to the dashboard
            </Link>
          }
        />
      </div>
    </main>
  );
}
