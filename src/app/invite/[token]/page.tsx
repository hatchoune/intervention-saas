import type { Metadata } from 'next';
import Link from 'next/link';

import { AcceptInvitationForm } from '@/app/invite/[token]/accept-invitation-form';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageContainer } from '@/components/ui/page-header';
import { getSessionContext } from '@/lib/auth/session';
import { isSupabaseConfigured } from '@/lib/env';

export const metadata: Metadata = { title: 'Organisation invitation' };

/**
 * Invitation landing page. Signing in (or up) first is required because the
 * `accept_invitation` SQL function matches the token against the authenticated
 * user's e-mail address.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <PageContainer className="max-w-xl py-10">
        <Alert variant="warning" title="Application not configured">
          Supabase credentials are missing. Follow the{' '}
          <Link href="/setup">setup guide</Link> first.
        </Alert>
      </PageContainer>
    );
  }

  const session = await getSessionContext();
  const nextPath = `/invite/${encodeURIComponent(token)}`;

  return (
    <PageContainer className="max-w-xl py-10">
      <Card>
        <CardHeader>
          <div>
            <CardTitle as="h1">Join the organisation</CardTitle>
            <CardDescription>
              You have been invited to a {process.env.NEXT_PUBLIC_APP_NAME || 'FieldFlow'}{' '}
              workspace. The invitation must be redeemed with the e-mail address it was sent to.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {session ? (
            <>
              <p className="text-sm text-slate-600">
                Signed in as <span className="font-medium">{session.user.email}</span>.
              </p>
              <AcceptInvitationForm token={token} />
            </>
          ) : (
            <>
              <Alert variant="info">
                Sign in or create an account with the invited e-mail address to accept.
              </Alert>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/sign-in?next=${encodeURIComponent(nextPath)}`}
                  className={buttonClasses('primary', 'md')}
                >
                  Sign in
                </Link>
                <Link
                  href={`/sign-up?next=${encodeURIComponent(nextPath)}`}
                  className={buttonClasses('outline', 'md')}
                >
                  Create an account
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
