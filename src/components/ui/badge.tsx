import type { BadgeTone } from '@/lib/domain/status';
import { cn } from '@/lib/utils/cn';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-rose-50 text-rose-700 ring-rose-200',
  accent: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap',
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Dot indicator used in the planning views. */
export function StatusDot({ tone = 'neutral', className }: { tone?: BadgeTone; className?: string }) {
  const colors: Record<BadgeTone, string> = {
    neutral: 'bg-slate-400',
    info: 'bg-sky-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
    accent: 'bg-indigo-500',
  };

  return <span aria-hidden className={cn('inline-block size-2 rounded-full', colors[tone], className)} />;
}
