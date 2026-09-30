import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SignInForm, SignedOutNotice } from '@/app/(auth)/sign-in/sign-in-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/auth/session';
import { isSupabaseConfigured } from '@/lib/env';

// Resolves the current user from cookies: render per request, never prerendered.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; signedOut?: string }>;
}) {
  const params = await searchParams;

  if (!isSupabaseConfigured()) redirect('/setup');

  // Already signed in: skip the form.
  const user = await getCurrentUser();
  if (user) redirect(params.next?.startsWith('/') ? params.next : '/dashboard');

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle as="h1">Sign in</CardTitle>
          <CardDescription>Access your organisation workspace.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {params.signedOut ? <SignedOutNotice /> : null}
        <SignInForm redirectTo={params.next} />
        <p className="text-sm text-slate-600">
          No account yet?{' '}
          <Link href="/sign-up" className="font-medium text-indigo-600 hover:text-indigo-500">
            Create one for your business
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
