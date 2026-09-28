'use client';

import { Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';

import { Button, type ButtonProps } from '@/components/ui/button';

export interface SubmitButtonProps extends Omit<ButtonProps, 'type'> {
  /** Label shown while the form is being submitted. */
  pendingLabel?: string;
}

/**
 * Submit button that disables itself and shows a spinner while the enclosing
 * form (progressive-enhancement aware) is submitting.
 */
export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

/** Small inline spinner for non-form pending states. */
export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      aria-hidden
      className={className ? `${className} animate-spin` : 'size-4 animate-spin'}
    />
  );
}
