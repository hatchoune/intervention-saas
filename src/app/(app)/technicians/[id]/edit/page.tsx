import { notFound } from 'next/navigation';

import {
  TechnicianForm,
  type TechnicianFormDefaults,
} from '@/components/technicians/technician-form';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { requireCapability } from '@/lib/auth/session';
import { getTechnician, listMemberOptions } from '@/lib/db/technicians';

export default async function EditTechnicianPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireCapability('technicians.manage', `/technicians/${id}/edit`);

  const technician = await getTechnician(session.organization.id, id);
  if (!technician) notFound();

  const members = await listMemberOptions(session.organization.id, {
    excludeTechnicianId: technician.id,
  });

  const defaults: TechnicianFormDefaults = {
    id: technician.id,
    fullName: technician.full_name,
    email: technician.email ?? '',
    phone: technician.phone ?? '',
    jobTitle: technician.job_title ?? '',
    skills: technician.skills.join(', '),
    status: technician.status,
    color: technician.color,
    hourlyRate: technician.hourly_rate === null ? '' : String(technician.hourly_rate),
    userId: technician.user_id ?? '',
    notes: technician.notes ?? '',
    isActive: technician.is_active,
  };

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        title={`Edit ${technician.full_name}`}
        description="Skills, availability and the login linked to this profile."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Technicians', href: '/technicians' },
          { label: technician.full_name, href: `/technicians/${technician.id}` },
          { label: 'Edit' },
        ]}
      />

      <TechnicianForm
        mode="update"
        members={members}
        defaults={defaults}
        cancelHref={`/technicians/${technician.id}`}
      />
    </PageContainer>
  );
}
