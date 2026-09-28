import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SignUpForm } from '@/app/(auth)/sign-up/sign-up-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/auth/session';
import { isSupabaseConfigured } from '@/lib/env';

export const metadata: Metadata = { title: 'Create your account' };

export default async function SignUpPage() {
  if (!isSupabaseConfigured()) redirect('/setup');

  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle as="h1">Create your workspace</CardTitle>
          <CardDescription>
            One organisation per business. You become its administrator.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <SignUpForm />
      </CardContent>
    </Card>
  );
}
