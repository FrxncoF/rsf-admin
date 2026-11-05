import { useState } from 'react';
import { ClipboardList, History, ShieldCheck } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { cn, locationLabel } from '@/lib/utils';
import { MoodAvatar } from './MoodAvatar';
import { moodByValue, SECTIONS } from './options';
import { formatTime, shortName, useDailyLog } from './useDailyLog';
import { HygieneSection, IntakeSection, SkinSection, VitalsSection, WellbeingSection } from './sections';

// "mar 3 nov" → "Mar 3 nov"
const todayLabel = () => {
  const text = new Intl.DateTimeFormat('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })
    .format(new Date())
    .replace(/[.,]/g, '');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * Bitácora diaria del residente: se completa de a poco durante el día, por distintas cuidadoras.
 * Fase 1: estado local (se pierde al recargar). Fase 2: conectar useDailyLog al API.
 */
export default function DailyLogSheet({ resident }) {
  const { log, audit, lastEdit, lastBySection, update, addVitals, addPosture } = useDailyLog();
  const [history, setHistory] = useState({ open: false, section: null });

  const showHistory = (section = null) => setHistory({ open: true, section });
  const sectionProps = (key) => ({ lastEdit: lastBySection[key], onShowHistory: () => showHistory(key) });
  const mood = moodByValue(log.mood);

  return (
    <section className="space-y-4" aria-label="Bitácora diaria">
      {/* Header fijo: residente + ánimo + auditoría */}
      <div className="sticky top-14 z-20 -mx-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:top-3 lg:mx-0 lg:rounded-xl lg:border lg:shadow-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <MoodAvatar resident={resident} mood={log.mood} size="md" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-xs font-medium text-brand-600">
              <ClipboardList className="size-3.5" /> Bitácora · {todayLabel()}
            </p>
            <p className="truncate font-semibold text-slate-900">
              {resident.first_name} {resident.last_name}
            </p>
            <p className="truncate text-xs text-slate-500">
              {locationLabel(resident)} · {mood ? `${mood.emoji} ${mood.label}` : 'Ánimo sin registrar'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => showHistory()}
            className={cn(
              'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition sm:w-auto',
              lastEdit ? 'bg-accent-50 text-accent-800 hover:bg-accent-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
            )}
          >
            <ShieldCheck className="size-4 shrink-0" />
            <span className="flex-1 leading-tight">
              {lastEdit ? (
                <>
                  Última edición <span className="font-semibold">{formatTime(lastEdit.at)} hrs</span> por{' '}
                  <span className="font-semibold">{shortName(lastEdit.by)}</span>
                </>
              ) : (
                <span className="font-medium">Sin registros hoy</span>
              )}
            </span>
            <History className="size-4 shrink-0 opacity-60" />
          </button>
        </div>

        {/* Saltos rápidos entre secciones */}
        <nav className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]" aria-label="Secciones">
          {Object.entries(SECTIONS).map(([key, label]) => (
            <a
              key={key}
              href={`#${key}`}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium',
                lastBySection[key]
                  ? 'border-accent-300 bg-accent-50 text-accent-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              <span className={cn('size-1.5 rounded-full', lastBySection[key] ? 'bg-accent-500' : 'bg-slate-300')} />
              {label}
            </a>
          ))}
        </nav>
      </div>

      <VitalsSection log={log} addVitals={addVitals} {...sectionProps('vitals')} />
      <IntakeSection log={log} update={update} {...sectionProps('intake')} />
      <HygieneSection log={log} update={update} {...sectionProps('hygiene')} />
      <SkinSection log={log} update={update} addPosture={addPosture} {...sectionProps('skin')} />
      <WellbeingSection log={log} update={update} {...sectionProps('wellbeing')} />

      <p className="flex items-center justify-center gap-1.5 pb-4 text-center text-xs text-slate-400">
        <ShieldCheck className="size-3.5" /> Cada cambio queda registrado con la hora y la cuidadora que lo hizo.
      </p>

      <HistoryDialog
        open={history.open}
        section={history.section}
        audit={audit}
        onSection={(section) => setHistory({ open: true, section })}
        onClose={() => setHistory((h) => ({ ...h, open: false }))}
      />
    </section>
  );
}

function HistoryDialog({ open, section, audit, onSection, onClose }) {
  const entries = section ? audit.filter((e) => e.section === section) : audit;

  return (
    <Dialog open={open} onClose={onClose} title="Historial de hoy" description="Registro de cada cambio de la bitácora">
      <div className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {[[null, 'Todo'], ...Object.entries(SECTIONS)].map(([key, label]) => (
          <button
            key={key ?? 'all'}
            type="button"
            onClick={() => onSection(key)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium',
              section === key ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-slate-500">
          <History className="size-8 text-slate-300" />
          Aún no hay cambios registrados.
        </div>
      ) : (
        <ol className="relative space-y-4 border-l-2 border-slate-100 pl-5">
          {entries.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[1.6rem] top-1 size-3 rounded-full border-2 border-white bg-brand-500 ring-2 ring-brand-100" />
              <p className="text-sm text-slate-900">{e.text}</p>
              <p className="text-xs text-slate-500">
                <span className="font-semibold tabular-nums">{formatTime(e.at)} hrs</span> · {e.by}
                {!section && <span className="text-slate-400"> · {SECTIONS[e.section]}</span>}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Dialog>
  );
}
