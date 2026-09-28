import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ResetPasswordForm } from '@/app/(auth)/password-forms';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Choose a new password' };

/**
 * Reached through the e-mail link: `/auth/callback` exchanges the code for a
 * session and then redirects here, so a session must exist.
 */
export default async function ResetPasswordPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle as="h1">Link expired</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="warning">
            This password reset link is no longer valid. Request a new one to continue.
          </Alert>
          <a href="/forgot-password" className="text-sm font-medium text-indigo-600">
            Request a new link
          </a>
        </CardContent>
      </Card>
    );
  }

  if (!user) redirect('/sign-in');

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle as="h1">Choose a new password</CardTitle>
          <CardDescription>Signed in as {user.email}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm />
      </CardContent>
    </Card>
  );
}
