'use client';

import { useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils/cn';

export interface ModalProps {
  trigger: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  /** Extra classes for the panel (width control). */
  panelClassName?: string;
}

/**
 * Accessible modal built on the native `<dialog>` element: focus trapping,
 * Escape handling and backdrop behaviour come from the platform.
 */
export function Modal({ trigger, title, description, children, panelClassName }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  function openDialog() {
    dialogRef.current?.showModal();
    setOpen(true);
  }

  function closeDialog() {
    dialogRef.current?.close();
    setOpen(false);
  }

  return (
    <>
      <span onClick={openDialog} className="contents">
        {trigger}
      </span>

      <dialog
        ref={dialogRef}
        aria-labelledby="modal-title"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          // Click on the backdrop closes the dialog.
          if (event.target === dialogRef.current) closeDialog();
        }}
        className={cn(
          'w-[calc(100vw-2rem)] max-w-lg rounded-xl border border-slate-200 bg-white p-0 text-left shadow-xl backdrop:bg-slate-900/40',
          'open:animate-in',
          panelClassName,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-3.5">
          <div>
            <h2 id="modal-title" className="text-base font-semibold text-slate-900">
              {title}
            </h2>
            {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={closeDialog}
            aria-label="Close dialog"
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>

        <div className="px-5 py-4">{children}</div>
        {open ? null : <span className="sr-only">Dialog closed</span>}
      </dialog>
    </>
  );
}

export interface DangerSubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  confirmMessage: string;
  children: ReactNode;
}

/**
 * Submit button for destructive actions. The confirmation happens client side
 * only — the server action re-validates the permissions regardless.
 */
export function DangerSubmitButton({
  confirmMessage,
  children,
  onClick,
  ...props
}: DangerSubmitButtonProps) {
  return (
    <button
      type="submit"
      {...props}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {children}
    </button>
  );
}
