import {
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  HardHat,
  LayoutDashboard,
  Receipt,
  Settings,
  UserCircle,
  Users,
} from 'lucide-react';

import { can, type Capability } from '@/lib/domain/permissions';
import type { OrganizationRole } from '@/types/database';

export interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  /** Hidden when the current role lacks this capability. */
  capability?: Capability;
  /** Highlighted in the mobile bottom navigation. */
  primary?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

const ICON_CLASS = 'size-[18px] shrink-0';

/**
 * Single source of truth for the application navigation. Items are filtered by
 * role so a technician never sees billing screens (the server also enforces it).
 */
export function buildNavSections(role: OrganizationRole): NavSection[] {
  const sections: NavSection[] = [
    {
      title: 'Operations',
      items: [
        {
          label: 'Dashboard',
          href: '/dashboard',
          icon: <LayoutDashboard className={ICON_CLASS} />,
          primary: true,
        },
        {
          label: 'Planning',
          href: '/planning',
          icon: <CalendarDays className={ICON_CLASS} />,
          primary: true,
        },
        {
          label: 'Interventions',
          href: '/interventions',
          icon: <ClipboardList className={ICON_CLASS} />,
          primary: true,
        },
      ],
    },
    {
      title: 'Directory',
      items: [
        {
          label: 'Customers',
          href: '/customers',
          icon: <Users className={ICON_CLASS} />,
          primary: true,
        },
        {
          label: 'Technicians',
          href: '/technicians',
          icon: <HardHat className={ICON_CLASS} />,
          primary: true,
        },
      ],
    },
    {
      title: 'Billing',
      items: [
        {
          label: 'Quotes',
          href: '/quotes',
          icon: <FileText className={ICON_CLASS} />,
          capability: 'quotes.manage',
        },
        {
          label: 'Invoices',
          href: '/invoices',
          icon: <Receipt className={ICON_CLASS} />,
          capability: 'invoices.manage',
        },
      ],
    },
    {
      title: 'Settings',
      items: [
        {
          label: 'My profile',
          href: '/settings/profile',
          icon: <UserCircle className={ICON_CLASS} />,
        },
        {
          label: 'Organisation',
          href: '/settings/organization',
          icon: <Building2 className={ICON_CLASS} />,
          capability: 'organization.edit',
        },
        {
          label: 'Team',
          href: '/settings/team',
          icon: <Settings className={ICON_CLASS} />,
          capability: 'team.manage',
        },
      ],
    },
  ];

  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.capability || can(item.capability, role)),
    }))
    .filter((section) => section.items.length > 0);
}

/** Items shown in the mobile bottom bar (max 4 + "more"). */
export function primaryNavItems(role: OrganizationRole): NavItem[] {
  return buildNavSections(role)
    .flatMap((section) => section.items)
    .filter((item) => item.primary)
    .slice(0, 5);
}
