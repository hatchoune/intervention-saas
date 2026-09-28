import type { Metadata, Viewport } from 'next';

import { APP_NAME } from '@/lib/env';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — Field service management`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    'Plan interventions, manage customers and technicians, and invoice work — built for plumbing, electrical, HVAC, maintenance and cleaning businesses.',
  applicationName: APP_NAME,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#4f46e5',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
