'use client';

import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';

import { buttonClasses } from '@/components/ui/button';

/**
 * Toolbar above the printable document. The whole bar is `print-hidden`, so
 * only the document itself reaches the paper / PDF.
 */
export function PrintToolbar({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <div className="print-hidden flex flex-wrap items-center justify-between gap-2">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {backLabel}
      </Link>
      <button type="button" onClick={() => window.print()} className={buttonClasses('primary', 'md')}>
        <Printer aria-hidden className="size-4" />
        Print / Save as PDF
      </button>
    </div>
  );
}
