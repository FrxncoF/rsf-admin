import { cn } from '@/lib/utils';
import { SosBadge, TimeChip, isAM } from './time';

const WEEK = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/**
 * Medicamentos de un residente para armar el pastillero: mañana (AM) y tarde/noche (PM)
 * en columnas separadas. `printable` agrega casillas de la semana para ir marcando.
 */
export function PillboxTable({ medications, printable = false }) {
  if (medications.length === 0) {
    return <p className={cn('text-sm text-slate-400', printable ? 'px-2 py-1.5' : 'px-3 py-3')}>Sin medicamentos registrados.</p>;
  }
  const cell = printable ? 'px-2 py-1 align-top' : 'px-3 py-2 align-top';

  return (
    <div className={printable ? '' : 'overflow-x-auto'}>
      <table className={cn('w-full text-left', printable ? 'text-[11px]' : 'text-sm')}>
        <thead className={cn('text-slate-500', printable ? 'text-[10px]' : 'text-xs')}>
          <tr className="border-b border-slate-200">
            <th className={cn(cell, 'font-medium')}>Medicamento</th>
            <th className={cn(cell, 'font-medium')}>Dosis</th>
            <th className={cn(cell, 'font-medium text-amber-700')}>Mañana · AM</th>
            <th className={cn(cell, 'font-medium text-indigo-700')}>Tarde/noche · PM</th>
            <th className={cn(cell, 'font-medium')}>Indicaciones</th>
            {printable && (
              <th className={cn(cell, 'whitespace-nowrap text-center font-medium')}>
                {WEEK.map((d) => (
                  <span key={d} className="inline-block w-4">
                    {d}
                  </span>
                ))}
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {medications.map((m) => {
            const am = m.times.filter(isAM);
            const pm = m.times.filter((t) => !isAM(t));
            return (
              <tr key={m.id} className={cn(m.is_sos && 'bg-red-50/40')}>
                <td className={cn(cell, 'font-semibold text-slate-900')}>{m.name}</td>
                <td className={cn(cell, 'text-slate-700')}>{m.dose}</td>
                <td className={cell}>
                  <Times list={am} sos={m.is_sos} />
                </td>
                <td className={cell}>
                  <Times list={pm} sos={m.is_sos} />
                </td>
                <td className={cn(cell, 'text-slate-600')}>
                  {m.is_sos && <SosBadge className="mr-1" />}
                  {[m.schedule, m.instructions].filter(Boolean).join(' · ') || (m.is_sos ? 'Solo si se necesita' : '')}
                  {!m.is_sos && m.times.length === 0 && <span className="text-amber-700">Sin horario</span>}
                </td>
                {printable && (
                  <td className={cn(cell, 'whitespace-nowrap text-center')}>
                    {WEEK.map((d) => (
                      <span key={d} className="mx-[1px] inline-block size-3.5 rounded-sm border border-slate-400 align-middle" />
                    ))}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Times({ list, sos }) {
  if (list.length === 0) return <span className="text-slate-300">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {list.map((t) => (
        <TimeChip key={t} time={t} muted={sos} />
      ))}
    </span>
  );
}
