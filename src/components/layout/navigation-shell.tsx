'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { LogOut, Menu, X } from 'lucide-react';

import type { NavItem, NavSection } from '@/components/layout/nav-config';
import { Avatar } from '@/components/ui/data-display';
import { signOutAction } from '@/lib/actions/auth';
import { cn } from '@/lib/utils/cn';

export interface NavigationShellProps {
  sections: NavSection[];
  primaryItems: NavItem[];
  organizationName: string;
  roleLabel: string;
  userName: string | null;
  userEmail: string;
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Responsive application navigation.
 *  - >= lg: permanent sidebar
 *  - < lg: slide-over drawer + bottom tab bar for the primary sections
 * The active route is derived from `usePathname`; everything else is static.
 */
export function NavigationShell({
  sections,
  primaryItems,
  organizationName,
  roleLabel,
  userName,
  userEmail,
}: NavigationShellProps) {
  const pathname = usePathname();
  /**
   * The drawer is stored as "the route it was opened on" instead of a boolean.
   * Navigating therefore closes it automatically — the derived value cannot stay
   * `true` once `pathname` changes — with no effect and no extra render.
   */
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;

  function openDrawer(): void {
    setOpenedOn(pathname);
  }

  function closeDrawer(): void {
    setOpenedOn(null);
  }

  const navList = (
    <nav aria-label="Main navigation" className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="px-2 pb-1.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            {section.title}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const identity = (
    <div className="border-t border-slate-200 p-3">
      <div className="flex items-center gap-2.5">
        <Avatar name={userName ?? userEmail} size="sm" color="#4f46e5" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">{userName ?? 'Account'}</p>
          <p className="truncate text-xs text-slate-500">{userEmail}</p>
        </div>
      </div>
      <form action={signOutAction} className="mt-2">
        <button
          type="submit"
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
        >
          <LogOut aria-hidden className="size-4" />
          Sign out
        </button>
      </form>
    </div>
  );

  const brand = (
    <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4">
      <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
        {organizationName.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">{organizationName}</p>
        <p className="text-xs text-slate-500">{roleLabel}</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex print-hidden">
        {brand}
        {navList}
        {identity}
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-3 py-2.5 backdrop-blur lg:hidden print-hidden">
        <button
          type="button"
          onClick={openDrawer}
          aria-label="Open navigation menu"
          aria-expanded={open}
          className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100"
        >
          <Menu aria-hidden className="size-5" />
        </button>
        <span className="flex size-7 items-center justify-center rounded-md bg-indigo-600 text-xs font-bold text-white">
          {organizationName.slice(0, 1).toUpperCase()}
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
          {organizationName}
        </p>
      </header>

      {/* Mobile drawer */}
      <div
        className={cn(
          'fixed inset-0 z-40 lg:hidden print-hidden',
          open ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        aria-hidden={!open}
      >
        <div
          className={cn(
            'absolute inset-0 bg-slate-900/40 transition-opacity',
            open ? 'opacity-100' : 'opacity-0',
          )}
          onClick={closeDrawer}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className={cn(
            'absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl transition-transform duration-200',
            open ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
            <span className="px-1 text-sm font-semibold text-slate-900">Menu</span>
            <button
              type="button"
              onClick={closeDrawer}
              aria-label="Close navigation menu"
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
          {brand}
          {navList}
          {identity}
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Quick navigation"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden print-hidden"
      >
        {primaryItems.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-medium transition-colors',
                active ? 'text-indigo-700' : 'text-slate-500',
              )}
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

