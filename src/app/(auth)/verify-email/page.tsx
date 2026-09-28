import type { Metadata } from 'next';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Confirm your e-mail' };

/**
 * Shown after sign-up when Supabase e-mail confirmation is enabled.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle as="h1">Confirm your e-mail address</CardTitle>
          <CardDescription>
            {email ? `We sent a confirmation link to ${email}.` : 'We sent you a confirmation link.'}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-600">
        <p>
          Open the link in that e-mail to activate your account. If you configured the project
          without e-mail confirmation (Supabase → Authentication → Providers → Email), you can sign
          in right away.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>The link expires after a short while — request a new one if needed.</li>
          <li>Check your spam folder if nothing arrives within a minute.</li>
        </ul>
        <a href="/sign-in" className="inline-block font-medium text-indigo-600 hover:text-indigo-500">
          Back to sign in
        </a>
      </CardContent>
    </Card>
  );
}
