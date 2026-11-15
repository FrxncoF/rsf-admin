import { cn } from '@/lib/utils';
import { dayTitle, longDay, shortDay } from './bookingsApi';

/**
 * Selector de día y bloque horario (página pública y panel interno).
 * `days`: [{ date, closed, slots: [{ start, end, capacity, remaining }] }]
 */
export function SlotPicker({ days, date, start, onChange }) {
  const selectedDay = days.find((d) => d.date === date);

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Día</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {days.map((d) => {
            const [weekday, num] = shortDay(d.date);
            const full = !d.closed && d.slots.every((s) => s.remaining === 0);
            const disabled = Boolean(d.closed) || full || d.slots.length === 0;
            return (
              <button
                key={d.date}
                type="button"
                disabled={disabled}
                title={d.closed || (full ? 'Sin cupos' : longDay(d.date))}
                onClick={() => onChange({ date: d.date, start: null })}
                className={cn(
                  'flex flex-col items-center rounded-xl border px-1 py-2 text-sm transition',
                  date === d.date
                    ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50',
                  disabled && 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300 hover:border-slate-100 hover:bg-slate-50',
                )}
              >
                <span className="text-xs capitalize">{weekday}</span>
                <span className="text-lg font-semibold leading-tight">{num}</span>
                {(d.closed || full) && <span className="text-[10px]">{d.closed ? 'Cerrado' : 'Lleno'}</span>}
              </button>
            );
          })}
        </div>
        {days.some((d) => d.closed) && (
          <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
            {days
              .filter((d) => d.closed)
              .map((d) => (
                <li key={d.date}>
                  {dayTitle(d.date)}: {d.closed}
                </li>
              ))}
          </ul>
        )}
      </div>

      {selectedDay && (
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">
            Horario · {dayTitle(selectedDay.date)}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {selectedDay.slots.map((s) => {
              const full = s.remaining === 0;
              return (
                <button
                  key={s.start}
                  type="button"
                  disabled={full}
                  onClick={() => onChange({ date: selectedDay.date, start: s.start })}
                  className={cn(
                    'flex items-center justify-between rounded-xl border px-4 py-3 text-left transition',
                    start === s.start
                      ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-500/30'
                      : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/50',
                    full && 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-100 hover:bg-slate-50',
                  )}
                >
                  <span className="text-base font-semibold tabular-nums">
                    {s.start} – {s.end}
                  </span>
                  <span className={cn('text-xs', full ? 'text-slate-400' : 'text-accent-700')}>
                    {full ? 'Lleno' : s.capacity > 1 ? `Quedan ${s.remaining}` : 'Disponible'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
