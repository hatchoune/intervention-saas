import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { CreateOrganizationForm } from '@/app/onboarding/create-organization-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageContainer } from '@/components/ui/page-header';
import { getSessionContext } from '@/lib/auth/session';
import { isSupabaseConfigured } from '@/lib/env';

// Resolves the session from cookies: render per request, never prerendered.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Set up your organisation' };

/**
 * Landing page for signed-up users without a workspace yet: either they create
 * one, or they accept the invitation waiting for them.
 */
export default async function OnboardingPage() {
  if (!isSupabaseConfigured()) redirect('/setup');

  const session = await getSessionContext();
  if (!session) redirect('/sign-in?next=/onboarding');
  if (session.organization) redirect('/dashboard');

  return (
    <PageContainer className="max-w-xl py-10">
      <Card>
        <CardHeader>
          <div>
            <CardTitle as="h1">Create your organisation</CardTitle>
            <CardDescription>
              Your workspace holds your customers, technicians, planning and billing.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <CreateOrganizationForm />
          <p className="text-sm text-slate-600">
            Were you invited by a colleague? Open the invitation link you received instead — it
            will attach your account to the existing workspace.
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
