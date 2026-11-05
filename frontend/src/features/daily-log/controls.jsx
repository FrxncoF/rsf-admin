import { Check, History, Minus, Plus } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { formatTime, shortName } from './useDailyLog';

// Color de cada opción cuando está seleccionada
const TONES = {
  good: 'border-accent-500 bg-accent-50 text-accent-800 ring-accent-500/30',
  neutral: 'border-brand-500 bg-brand-50 text-brand-800 ring-brand-500/30',
  warn: 'border-amber-500 bg-amber-50 text-amber-800 ring-amber-500/30',
  bad: 'border-red-500 bg-red-50 text-red-700 ring-red-500/30',
};

const optionBase =
  'relative flex min-h-12 select-none items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2 ' +
  'text-sm font-medium transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500';
const optionIdle = 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50';

/** Botón tipo toggle. `tone` define el color al estar activo. */
export function OptionButton({ selected, tone = 'neutral', className, children, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(optionBase, selected ? cn(TONES[tone], 'ring-2') : optionIdle, className)}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Selección única. Tocar la opción activa la desmarca (corrige errores sin escribir).
 * `render(option)` permite personalizar el contenido del botón.
 */
export function ChoiceGroup({ options, value, onChange, columns = 'grid-cols-2 sm:grid-cols-4', render, label }) {
  return (
    <div role="group" aria-label={label} className={cn('grid gap-2', columns)}>
      {options.map((o) => (
        <OptionButton
          key={o.value}
          tone={o.tone}
          selected={value === o.value}
          onClick={() => onChange(value === o.value ? null : o.value, o)}
        >
          {render ? render(o) : <OptionLabel option={o} />}
        </OptionButton>
      ))}
    </div>
  );
}

/** Selección múltiple con check visible. */
export function MultiChoice({ options, values, onToggle, columns = 'grid-cols-2 sm:grid-cols-3', label }) {
  return (
    <div role="group" aria-label={label} className={cn('grid gap-2', columns)}>
      {options.map((o) => {
        const selected = values.includes(o.value);
        return (
          <OptionButton
            key={o.value}
            tone={o.tone ?? 'neutral'}
            selected={selected}
            onClick={() => onToggle(o.value, !selected, o)}
            className="justify-start text-left"
          >
            <span
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-md border-2',
                selected ? 'border-current bg-current' : 'border-slate-300',
              )}
            >
              {selected && <Check className="size-3.5 text-white" strokeWidth={3} />}
            </span>
            <OptionLabel option={o} />
          </OptionButton>
        );
      })}
    </div>
  );
}

function OptionLabel({ option }) {
  return (
    <span className="flex min-w-0 flex-col items-center leading-tight">
      <span className="flex items-center gap-1.5">
        {(option.emoji || option.icon) && (
          <span aria-hidden="true" className="text-lg">
            {option.emoji || option.icon}
          </span>
        )}
        {option.label}
      </span>
      {option.hint && <span className="text-[11px] font-normal opacity-70">{option.hint}</span>}
    </span>
  );
}

/** Contador táctil (+ / −). */
export function Stepper({ value, onChange, min = 0, max = 20, label }) {
  return (
    <div className="inline-flex items-center rounded-xl border-2 border-slate-200 bg-white" aria-label={label}>
      <button
        type="button"
        aria-label={`Restar ${label}`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className="flex size-12 items-center justify-center rounded-l-xl text-slate-600 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-30"
      >
        <Minus className="size-5" />
      </button>
      <span className="w-10 text-center text-lg font-semibold tabular-nums text-slate-900">{value}</span>
      <button
        type="button"
        aria-label={`Sumar ${label}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className="flex size-12 items-center justify-center rounded-r-xl text-brand-700 hover:bg-brand-50 active:bg-brand-100 disabled:opacity-30"
      >
        <Plus className="size-5" />
      </button>
    </div>
  );
}

/** Subtítulo de un bloque dentro de una sección. */
export function FieldGroup({ title, aside, children, className }) {
  return (
    <div className={cn('space-y-2.5', className)}>
      {(title || aside) && (
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
          {aside}
        </div>
      )}
      {children}
    </div>
  );
}

/** Tarjeta de sección con indicador de última edición (trazabilidad por sección). */
export function SectionCard({ id, icon: Icon, title, lastEdit, onShowHistory, children }) {
  return (
    <Card id={id} className="scroll-mt-60 overflow-hidden lg:scroll-mt-40">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-5">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
            <Icon className="size-4.5" />
          </span>
          {title}
        </h3>
        {lastEdit ? (
          <button
            type="button"
            onClick={onShowHistory}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-right text-xs text-slate-500 hover:bg-white hover:text-brand-700"
            title="Ver historial de esta sección"
          >
            <History className="size-3.5 shrink-0" />
            <span>
              {formatTime(lastEdit.at)} · <span className="font-medium">{shortName(lastEdit.by)}</span>
            </span>
          </button>
        ) : (
          <span className="text-xs text-slate-400">Sin registros hoy</span>
        )}
      </div>
      <div className="space-y-6 p-4 sm:p-5">{children}</div>
    </Card>
  );
}
