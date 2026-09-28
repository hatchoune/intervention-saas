import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils/cn';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

const VARIANTS: Record<AlertVariant, { wrapper: string; icon: React.ReactNode }> = {
  info: {
    wrapper: 'border-sky-200 bg-sky-50 text-sky-900',
    icon: <Info aria-hidden className="size-4 text-sky-600" />,
  },
  success: {
    wrapper: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    icon: <CheckCircle2 aria-hidden className="size-4 text-emerald-600" />,
  },
  warning: {
    wrapper: 'border-amber-200 bg-amber-50 text-amber-900',
    icon: <AlertTriangle aria-hidden className="size-4 text-amber-600" />,
  },
  error: {
    wrapper: 'border-rose-200 bg-rose-50 text-rose-900',
    icon: <XCircle aria-hidden className="size-4 text-rose-600" />,
  },
};

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children?: React.ReactNode;
  className?: string;
  /** Renders `role="alert"` (errors) instead of `role="status"`. */
  live?: boolean;
}

export function Alert({ variant = 'info', title, children, className, live }: AlertProps) {
  const { wrapper, icon } = VARIANTS[variant];

  return (
    <div
      role={live || variant === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm', wrapper, className)}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 space-y-0.5">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="[&_a]:underline">{children}</div> : null}
      </div>
    </div>
  );
}

/**
 * Renders the message of a server action result. `state` is the object returned
 * by the action, so this works with both `useActionState` and plain props.
 */
export function ActionAlert({
  status,
  message,
  className,
}: {
  status: 'idle' | 'success' | 'error';
  message?: string;
  className?: string;
}) {
  if (status === 'idle' || !message) return null;

  return (
    <Alert variant={status === 'success' ? 'success' : 'error'} className={className} live>
      {message}
    </Alert>
  );
}
