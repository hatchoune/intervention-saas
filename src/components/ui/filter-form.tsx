'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * Progressive-enhancement helper for filter bars.
 *
 * The parent form keeps `method="get"`, so filtering still works without
 * JavaScript. This component only adds the convenience of submitting on
 * select change and after the user stops typing in a search input.
 */
export function FilterForm({
  children,
  className,
  debounceMs = 450,
  ...props
}: React.FormHTMLAttributes<HTMLFormElement> & { debounceMs?: number; children: ReactNode }) {
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function submitSoon() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => formRef.current?.requestSubmit(), debounceMs);
  }

  return (
    <form
      ref={formRef}
      method="get"
      role="search"
      className={cn('flex flex-wrap items-end gap-2 print-hidden', className)}
      onChange={(event) => {
        const target = event.target as HTMLElement;
        if (target.tagName === 'SELECT') {
          formRef.current?.requestSubmit();
        }
      }}
      onInput={(event) => {
        const target = event.target as HTMLElement;
        if (target instanceof HTMLInputElement && target.type === 'search') {
          submitSoon();
        }
      }}
      {...props}
    >
      {children}
      <noscript>
        <button type="submit" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          Apply filters
        </button>
      </noscript>
    </form>
  );
}

/** Clears every field of the enclosing filter form. */
export function ResetFiltersButton({ label = 'Reset' }: { label?: string }) {
  return (
    <button
      type="reset"
      className="h-10 rounded-lg px-3 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
      onClick={(event) => {
        const form = event.currentTarget.form;
        if (!form) return;
        // Remove the query string entirely instead of submitting empty inputs.
        window.location.href = window.location.pathname;
      }}
    >
      {label}
    </button>
  );
}
