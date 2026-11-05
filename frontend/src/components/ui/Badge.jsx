import { cn } from '@/lib/utils';

const VARIANTS = {
  default: 'bg-slate-100 text-slate-700 ring-slate-200',
  success: 'bg-accent-50 text-accent-800 ring-accent-200',
  muted: 'bg-slate-100 text-slate-500 ring-slate-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
};

export function Badge({ variant = 'default', className, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
