import {
  TechnicianForm,
  type TechnicianFormDefaults,
} from '@/components/technicians/technician-form';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { requireCapability } from '@/lib/auth/session';
import { listMemberOptions } from '@/lib/db/technicians';

export default async function NewTechnicianPage() {
  const session = await requireCapability('technicians.manage', '/technicians/new');
  const members = await listMemberOptions(session.organization.id);

  const defaults: TechnicianFormDefaults = {
    id: null,
    fullName: '',
    email: '',
    phone: '',
    jobTitle: '',
    skills: '',
    status: 'available',
    color: '#2563eb',
    hourlyRate: '',
    userId: '',
    notes: '',
    isActive: true,
  };

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        title="New technician"
        description="Add a member of your field team so work can be scheduled and dispatched."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Technicians', href: '/technicians' },
          { label: 'New' },
        ]}
      />

      <TechnicianForm
        mode="create"
        members={members}
        defaults={defaults}
        cancelHref="/technicians"
      />
    </PageContainer>
  );
}
