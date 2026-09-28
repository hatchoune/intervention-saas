import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil, Receipt } from 'lucide-react';

import { InterventionPriorityBadge, InterventionStatusBadge } from '@/components/interventions/badges';
import { InterventionQuickActions } from '@/components/interventions/intervention-quick-actions';
import { InterventionTimeline } from '@/components/interventions/intervention-timeline';
import { PhotoGallery } from '@/components/interventions/photo-gallery';
import { PhotoUploader } from '@/components/interventions/photo-uploader';
import { buttonClasses } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/data-display';
import { EmptyState } from '@/components/ui/empty-state';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { MetaItem, MetaList } from '@/components/ui/table';
import { requireOrganization } from '@/lib/auth/session';
import {
  getIntervention,
  listTechnicianOptions,
  signInterventionPhotos,
} from '@/lib/db/interventions';
import { can, canEditIntervention } from '@/lib/domain/permissions';
import { INTERVENTION_STATUS_META, INTERVENTION_STATUS_TRANSITIONS } from '@/lib/domain/status';
import { formatDate, formatDateTime, formatTime } from '@/lib/utils/format';

export default async function InterventionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireOrganization(`/interventions/${id}`);
  const organizationId = session.organization.id;

  const detail = await getIntervention(organizationId, id);
  if (!detail) notFound();

  const { intervention, customer, customerAddress, technician, photos, activity } = detail;

  const [photosWithUrls, technicians] = await Promise.all([
    signInterventionPhotos(photos),
    listTechnicianOptions(organizationId, { includeInactive: true }),
  ]);

  const canManage = can('interventions.manage', session.role);
  const mayEdit = canEditIntervention(session.role, {
    assignedTechnicianUserId: technician?.user_id ?? null,
    userId: session.user.id,
  });
  const canInvoice = can('invoices.manage', session.role);

  const transitions = INTERVENTION_STATUS_TRANSITIONS[intervention.status].filter(
    (status) => status !== intervention.status,
  );

  const addressLine1 = intervention.address_line1 ?? customerAddress?.address_line1 ?? customer?.address_line1 ?? null;
  const addressLine2 = intervention.address_line2 ?? customerAddress?.address_line2 ?? customer?.address_line2 ?? null;
  const postalCode = intervention.postal_code ?? customerAddress?.postal_code ?? customer?.postal_code ?? null;
  const city = intervention.city ?? customerAddress?.city ?? customer?.city ?? null;
  const country = intervention.country ?? customerAddress?.country ?? customer?.country ?? null;

  return (
    <PageContainer>
      <Link
        href="/interventions"
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft aria-hidden className="size-4" />
        All interventions
      </Link>

      <PageHeader
        title={intervention.title}
        description={`${intervention.reference} · ${INTERVENTION_STATUS_META[intervention.status].description}`}
        actions={
          <>
            {canInvoice ? (
              <Link
                href={`/invoices/new?interventionId=${intervention.id}`}
                className={buttonClasses('outline', 'md')}
              >
                <Receipt aria-hidden className="size-4" />
                Create invoice
              </Link>
            ) : null}
            {mayEdit ? (
              <Link
                href={`/interventions/${intervention.id}/edit`}
                className={buttonClasses('primary', 'md')}
              >
                <Pencil aria-hidden className="size-4" />
                Edit
              </Link>
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <InterventionStatusBadge status={intervention.status} />
        <InterventionPriorityBadge priority={intervention.priority} />
        {intervention.customer_address_id ? null : (
          <span className="text-xs text-slate-500">No saved site selected</span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle as="h2">Job</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <MetaList>
                <MetaItem label="Reference">{intervention.reference}</MetaItem>
                <MetaItem label="Priority">{intervention.priority}</MetaItem>
                <MetaItem label="Scheduled start">
                  {intervention.scheduled_start ? formatDateTime(intervention.scheduled_start) : 'Not scheduled'}
                </MetaItem>
                <MetaItem label="Scheduled end">
                  {intervention.scheduled_end
                    ? `${formatDate(intervention.scheduled_end)} · ${formatTime(intervention.scheduled_end)}`
                    : 'Not set'}
                </MetaItem>
                <MetaItem label="Created">{formatDateTime(intervention.created_at)}</MetaItem>
                <MetaItem label="Last updated">{formatDateTime(intervention.updated_at)}</MetaItem>
              </MetaList>

              <div>
                <h3 className="text-xs font-medium tracking-wide text-slate-500 uppercase">Description</h3>
                <p className="mt-1 text-sm whitespace-pre-wrap text-slate-700">
                  {intervention.description || 'No description provided.'}
                </p>
              </div>

              {intervention.completion_notes ? (
                <div>
                  <h3 className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                    Completion notes
                  </h3>
                  <p className="mt-1 text-sm whitespace-pre-wrap text-slate-700">
                    {intervention.completion_notes}
                  </p>
                </div>
              ) : null}

              {canManage ? (
                <div>
                  <h3 className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                    Internal notes
                  </h3>
                  <p className="mt-1 text-sm whitespace-pre-wrap text-slate-700">
                    {intervention.internal_notes || 'No internal notes.'}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">Photos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {mayEdit ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-slate-800">Add a photo</h3>
                  <PhotoUploader organizationId={organizationId} interventionId={intervention.id} />
                </div>
              ) : null}

              <PhotoGallery
                photos={photosWithUrls}
                canManage={canManage}
                currentUserId={session.user.id}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">History</CardTitle>
            </CardHeader>
            <CardContent>
              <InterventionTimeline intervention={intervention} activity={activity} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {mayEdit ? (
            <InterventionQuickActions
              interventionId={intervention.id}
              currentStatus={intervention.status}
              transitions={transitions}
              currentTechnicianId={intervention.technician_id ?? ''}
              technicians={technicians}
              canManage={canManage}
            />
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle as="h2">Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {customer ? (
                <>
                  <Link
                    href={`/customers/${customer.id}`}
                    className="block font-medium text-indigo-700 hover:underline"
                  >
                    {customer.name}
                  </Link>
                  <MetaList className="sm:grid-cols-1">
                    {customer.email ? <MetaItem label="E-mail">{customer.email}</MetaItem> : null}
                    {customer.phone ? <MetaItem label="Phone">{customer.phone}</MetaItem> : null}
                  </MetaList>
                </>
              ) : (
                <p className="text-sm text-slate-500">This customer is no longer available.</p>
              )}

              <div className="border-t border-slate-200 pt-3">
                <h3 className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Service address
                </h3>
                <address className="mt-1 text-sm not-italic text-slate-700">
                  {addressLine1 ? <span className="block">{addressLine1}</span> : null}
                  {addressLine2 ? <span className="block">{addressLine2}</span> : null}
                  {postalCode || city ? (
                    <span className="block">
                      {postalCode ?? ''} {city ?? ''}
                    </span>
                  ) : null}
                  {country ? <span className="block">{country}</span> : null}
                  {!addressLine1 && !city ? (
                    <span className="text-slate-500">No address recorded.</span>
                  ) : null}
                </address>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">Assigned technician</CardTitle>
            </CardHeader>
            <CardContent>
              {technician ? (
                <div className="flex items-center gap-3">
                  <Avatar name={technician.full_name} color={technician.color} size="lg" />
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{technician.full_name}</p>
                    <p className="text-xs text-slate-500">
                      {technician.job_title ?? 'Technician'}
                      {technician.phone ? ` · ${technician.phone}` : ''}
                    </p>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="Nobody assigned"
                  description="Assign a technician so the job shows up in the planning board."
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
