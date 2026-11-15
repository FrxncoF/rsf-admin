import { cn } from '@/lib/utils';

// Horario de medicamentos en formato 24 h. AM = 00:00–11:59, PM = 12:00–23:59.
export const isAM = (time) => time < '12:00';
export const periodOf = (time) => (isAM(time) ? 'AM' : 'PM');

const pad = (n) => String(n).padStart(2, '0');
export const nowHHMM = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Atajos del formulario: las horas más usadas en las hojas de tratamiento
export const COMMON_TIMES = ['07:00', '08:00', '13:00', '14:00', '20:00', '21:00'];

const CHIP = {
  AM: 'bg-amber-50 text-amber-800 ring-amber-200',
  PM: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
};

/** Hora como "08:00 AM" con color de mañana (ámbar) o tarde/noche (índigo). */
export function TimeChip({ time, muted, className, children }) {
  const period = periodOf(time);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ring-1 ring-inset',
        muted ? 'bg-slate-50 text-slate-500 ring-slate-200' : CHIP[period],
        className,
      )}
    >
      {time}
      <span className="text-[10px] font-medium opacity-70">{period}</span>
      {children}
    </span>
  );
}

export function SosBadge({ className }) {
  return (
    <span className={cn('inline-flex items-center rounded-md bg-red-50 px-1.5 py-0.5 text-xs font-bold text-red-700 ring-1 ring-inset ring-red-200', className)}>
      SOS
    </span>
  );
}

/** Horas de un medicamento: SOS + horas (en SOS, horas posibles en gris). */
export function MedicationTimes({ med, className }) {
  if (!med.is_sos && med.times.length === 0) {
    return <span className={cn('text-xs text-amber-700', className)}>Sin horario</span>;
  }
  return (
    <span className={cn('flex flex-wrap items-center gap-1', className)}>
      {med.is_sos && <SosBadge />}
      {med.times.map((t) => (
        <TimeChip key={t} time={t} muted={med.is_sos} />
      ))}
    </span>
  );
}
