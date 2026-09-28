'use client';

import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { buttonClasses } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Error boundary for the authenticated area. Server actions and data loaders
 * raise here; the underlying error message is only shown in development.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isDev = process.env.NODE_ENV !== 'production';

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle aria-hidden className="size-5 text-amber-500" />
          Something went wrong
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          The page could not be loaded. This is usually temporary — retry, and if the problem
          persists check the server logs or your Supabase configuration.
        </p>

        {isDev ? (
          <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
            {error.message}
            {error.digest ? `\n\ndigest: ${error.digest}` : ''}
          </pre>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <form action={reset}>
            <button type="submit" className={buttonClasses('primary', 'md')}>
              <RefreshCw aria-hidden className="size-4" />
              Try again
            </button>
          </form>
          <Link href="/dashboard" className={buttonClasses('outline', 'md')}>
            Back to dashboard
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
