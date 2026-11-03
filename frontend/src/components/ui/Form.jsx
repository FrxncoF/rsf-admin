import { cn } from '@/lib/utils';
import { localDigits } from '@/lib/phone';

const fieldBase =
  'w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm transition ' +
  'placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 ' +
  'disabled:bg-slate-100 disabled:text-slate-500 aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-red-500/20';

export function Input({ className, ...props }) {
  return <input className={cn(fieldBase, 'h-10', className)} {...props} />;
}

/**
 * Teléfono chileno: "+56" fijo a la izquierda y solo 9 dígitos editables.
 * `value` / `onChange(digits)` trabajan con los 9 dígitos locales, sin prefijo.
 */
export function PhoneInput({ value, onChange, className, invalid, ...props }) {
  return (
    <div
      className={cn(
        'flex h-10 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm transition',
        'focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/30',
        invalid && 'border-red-500 ring-red-500/20',
        className,
      )}
    >
      <span className="flex select-none items-center border-r border-slate-300 bg-slate-50 px-3 text-sm font-medium text-slate-600">
        +56
      </span>
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="912345678"
        className="w-full min-w-0 bg-transparent px-3 text-sm tracking-wide text-slate-900 placeholder:text-slate-400 focus:outline-none"
        value={value}
        // Sin maxLength: así se puede pegar "+56 9 1234 5678" y se limpia aquí
        onChange={(e) => onChange(localDigits(e.target.value))}
        aria-invalid={invalid || undefined}
        {...props}
      />
    </div>
  );
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cn(fieldBase, 'h-10 pr-8', className)} {...props}>
      {children}
    </select>
  );
}

export function Label({ className, ...props }) {
  return <label className={cn('text-sm font-medium text-slate-700', className)} {...props} />;
}

/** Label + control + mensaje de error */
export function Field({ label, htmlFor, error, hint, className, children }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : (
        hint && <p className="text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}
