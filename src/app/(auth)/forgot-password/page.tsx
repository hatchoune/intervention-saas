import type { Metadata } from 'next';

import { ForgotPasswordForm } from '@/app/(auth)/password-forms';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Reset your password' };

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle as="h1">Reset your password</CardTitle>
          <CardDescription>
            We will e-mail you a link to choose a new password.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <ForgotPasswordForm />
      </CardContent>
    </Card>
  );
}
