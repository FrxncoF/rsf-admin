import { AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Spinner({ className }) {
  return <Loader2 className={cn('size-6 animate-spin text-brand-600', className)} />;
}

export function FullScreenLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Spinner className="size-8" />
    </div>
  );
}

export function Alert({ children, className }) {
  if (!children) return null;
  return (
    <div role="alert" className={cn('flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700', className)}>
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-14 text-center', className)}>
      {Icon && (
        <div className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Icon className="size-6" />
        </div>
      )}
      <div>
        <p className="font-medium text-slate-900">{title}</p>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
