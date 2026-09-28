import { cn, initials } from '@/lib/utils/cn';

export interface AvatarProps {
  name?: string | null;
  color?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: 'size-7 text-[11px]',
  md: 'size-9 text-xs',
  lg: 'size-12 text-sm',
};

/**
 * Initials avatar. `color` (hex) lets technicians keep a stable colour across
 * the planning views; otherwise a deterministic colour is derived from the name.
 */
export function Avatar({ name, color, size = 'md', className }: AvatarProps) {
  const label = initials(name);

  return (
    <span
      aria-hidden
      style={color ? { backgroundColor: color } : undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-white',
        !color && 'bg-slate-500',
        SIZES[size],
        className,
      )}
    >
      {label}
    </span>
  );
}

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  href?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'accent';
  className?: string;
}

const TONE_RING: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'text-slate-500 bg-slate-100',
  success: 'text-emerald-600 bg-emerald-50',
  warning: 'text-amber-600 bg-amber-50',
  danger: 'text-rose-600 bg-rose-50',
  accent: 'text-indigo-600 bg-indigo-50',
};

export function StatCard({ label, value, hint, icon, href, tone = 'default', className }: StatCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
        {icon ? (
          <span className={cn('flex size-8 items-center justify-center rounded-lg', TONE_RING[tone])}>
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className={cn(
          'block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/30',
          className,
        )}
      >
        {content}
      </a>
    );
  }

  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white p-4 shadow-sm', className)}>
      {content}
    </div>
  );
}

export function ProgressBar({
  value,
  max = 100,
  label,
  tone = 'accent',
  className,
}: {
  value: number;
  max?: number;
  label?: string;
  tone?: 'accent' | 'success' | 'warning' | 'danger';
  className?: string;
}) {
  const ratio = max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  const colors = {
    accent: 'bg-indigo-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
  };

  return (
    <div className={cn('space-y-1', className)}>
      <div
        role="progressbar"
        aria-valuenow={Math.round(ratio)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
      >
        <div className={cn('h-full rounded-full transition-all', colors[tone])} style={{ width: `${ratio}%` }} />
      </div>
      {label ? <p className="text-xs text-slate-500">{label}</p> : null}
    </div>
  );
}
