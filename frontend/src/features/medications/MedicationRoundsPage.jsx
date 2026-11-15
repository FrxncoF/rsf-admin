import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, CheckCheck, Pill, RotateCcw, Siren } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input } from '@/components/ui/Form';
import { Alert, EmptyState, Spinner } from '@/components/ui/Feedback';
import { useSites } from '@/features/sites/SiteContext';
import { ResidentAvatar } from '@/features/residents/ResidentAvatar';
import { cn, roomLabel } from '@/lib/utils';
import { DOSE_STATUS, medicationsApi } from './medicationsApi';
import { MedicationTimes, SosBadge, TimeChip, nowHHMM, periodOf } from './time';

const SOS_TAB = 'SOS';
const doseKey = (medicationId, time) => `${medicationId}|${time}`;
const shortName = (r) => `${r.first_name.split(' ')[0]} ${r.last_name.split(' ')[0]}`;

function formatDate(isoDate) {
  const text = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${isoDate}T12:00:00`));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Hora en curso: la última toma que ya llegó (con 15 min de anticipación); si ninguna, la primera. */
function currentSlot(slots, isToday) {
  if (!slots.length) return SOS_TAB;
  if (!isToday) return slots[0];
  const d = new Date(Date.now() + 15 * 60_000);
  const now = nowHHMM(d);
  return [...slots].reverse().find((t) => t <= now) ?? slots[0];
}

/**
 * Medicación del día: las cuidadoras eligen la hora y marcan cada dosis
 * como Dado, Rechazó o No se dio. Los SOS se registran aparte, a la hora en que se dieron.
 */
export default function MedicationRoundsPage() {
  const { siteId, currentSite } = useSites();
  const [day, setDay] = useState('today'); // today | yesterday
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const [slot, setSlot] = useState(null);
  const [pending, setPending] = useState({}); // doseKey -> true mientras guarda
  const [askNote, setAskNote] = useState(null); // { resident, med, time, status }
  const [sosDialog, setSosDialog] = useState(null); // { resident, med }

  const load = useCallback(
    (silent = false) => {
      if (!silent) setState((s) => ({ ...s, loading: true }));
      const params = { site_id: siteId ?? undefined };
      if (day === 'yesterday') params.date = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA');
      medicationsApi
        .schedule(params)
        .then((data) => setState({ data, loading: false, error: '' }))
        .catch((err) => setState((s) => ({ ...s, loading: false, error: err.message })));
    },
    [siteId, day],
  );

  useEffect(() => load(), [load]);

  // Varias cuidadoras usan la pantalla a la vez: se actualiza cada minuto
  useEffect(() => {
    const id = setInterval(() => document.visibilityState === 'visible' && load(true), 60_000);
    return () => clearInterval(id);
  }, [load]);

  const data = state.data;
  const isToday = data ? data.date === data.today : true;

  const { slots, doses, sosItems } = useMemo(() => {
    const slotSet = new Set();
    const doseMap = new Map();
    const sos = [];
    for (const r of data?.residents ?? []) {
      for (const m of r.medications) {
        if (m.is_sos) sos.push({ resident: r, med: m });
        else m.times.forEach((t) => slotSet.add(t));
      }
      for (const d of r.doses) doseMap.set(doseKey(d.medication_id, d.time), d);
    }
    return { slots: [...slotSet].sort(), doses: doseMap, sosItems: sos };
  }, [data]);

  // Al cargar (o cambiar de día/sede) se elige la hora en curso
  useEffect(() => {
    if (data) setSlot((s) => (s && (s === SOS_TAB || slots.includes(s)) ? s : currentSlot(slots, isToday)));
  }, [data, slots, isToday]);

  const progress = (t) => {
    let total = 0;
    let done = 0;
    for (const r of data?.residents ?? []) {
      for (const m of r.medications) {
        if (!m.is_sos && m.times.includes(t)) {
          total += 1;
          if (doses.has(doseKey(m.id, t))) done += 1;
        }
      }
    }
    return { total, done };
  };

  const updateResidentDoses = (residentId, fn) =>
    setState((s) => ({
      ...s,
      data: { ...s.data, residents: s.data.residents.map((r) => (r.id === residentId ? { ...r, doses: fn(r.doses) } : r)) },
    }));

  async function record(resident, med, time, status, note = null) {
    const key = doseKey(med.id, time);
    setPending((p) => ({ ...p, [key]: true }));
    try {
      const saved = await medicationsApi.recordDose({ medication_id: med.id, date: data.date, time, status, note });
      updateResidentDoses(resident.id, (list) => [...list.filter((d) => doseKey(d.medication_id, d.time) !== key), saved]);
    } catch (err) {
      setState((s) => ({ ...s, error: err.message }));
    } finally {
      setPending((p) => ({ ...p, [key]: false }));
    }
  }

  async function undo(resident, dose) {
    const key = doseKey(dose.medication_id, dose.time);
    setPending((p) => ({ ...p, [key]: true }));
    try {
      await medicationsApi.removeDose(dose.id);
      updateResidentDoses(resident.id, (list) => list.filter((d) => d.id !== dose.id));
    } catch (err) {
      setState((s) => ({ ...s, error: err.message }));
    } finally {
      setPending((p) => ({ ...p, [key]: false }));
    }
  }

  const residentsAtSlot =
    slot && slot !== SOS_TAB
      ? (data?.residents ?? [])
          .map((r) => ({ resident: r, meds: r.medications.filter((m) => !m.is_sos && m.times.includes(slot)) }))
          .filter((x) => x.meds.length > 0)
      : [];

  const nowTime = nowHHMM();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Medicación</h1>
          <p className="mt-1 text-sm text-slate-500">
            {data ? formatDate(data.date) : '…'} · {currentSite ? `Sede ${currentSite.name}` : 'Todas las sedes'}
          </p>
        </div>
        <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm font-medium">
          {[
            ['today', 'Hoy'],
            ['yesterday', 'Ayer'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setDay(value)}
              className={cn('rounded-md px-4 py-1.5', day === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Alert>{state.error}</Alert>

      {state.loading && !data ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : slots.length === 0 && sosItems.length === 0 ? (
        <Card>
          <EmptyState
            icon={Pill}
            title="No hay medicamentos con horario"
            description="Los medicamentos se agregan en la ficha de cada residente, sección Salud."
          />
        </Card>
      ) : (
        <>
          {/* Horas del día */}
          <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            <div className="flex gap-2">
              {slots.map((t) => {
                const { total, done } = progress(t);
                const complete = done === total;
                const late = !complete && isToday && t < nowTime;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSlot(t)}
                    className={cn(
                      'flex min-w-[5.5rem] shrink-0 flex-col items-center rounded-xl border px-3 py-2 transition-colors',
                      slot === t ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/30' : 'border-slate-200 bg-white hover:bg-slate-50',
                    )}
                  >
                    <span className="text-base font-semibold tabular-nums text-slate-900">
                      {t} <span className="text-[11px] font-medium text-slate-500">{periodOf(t)}</span>
                    </span>
                    <span
                      className={cn(
                        'mt-0.5 flex items-center gap-1 text-xs font-medium tabular-nums',
                        complete ? 'text-accent-700' : late ? 'text-amber-700' : 'text-slate-500',
                      )}
                    >
                      {complete && <Check className="size-3.5" />}
                      {done}/{total}
                    </span>
                  </button>
                );
              })}
              {sosItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSlot(SOS_TAB)}
                  className={cn(
                    'flex min-w-[5.5rem] shrink-0 flex-col items-center justify-center rounded-xl border px-3 py-2',
                    slot === SOS_TAB ? 'border-red-400 bg-red-50 ring-2 ring-red-400/30' : 'border-slate-200 bg-white hover:bg-slate-50',
                  )}
                >
                  <span className="flex items-center gap-1 text-base font-semibold text-red-700">
                    <Siren className="size-4" /> SOS
                  </span>
                  <span className="text-xs text-slate-500">{sosItems.length} med.</span>
                </button>
              )}
            </div>
          </div>

          {slot === SOS_TAB ? (
            <SosList items={sosItems} doses={data.residents} onRegister={setSosDialog} onUndo={undo} pending={pending} showSite={!siteId} />
          ) : residentsAtSlot.length === 0 ? (
            <Card>
              <EmptyState icon={Pill} title="Nadie tiene medicamentos a esta hora" />
            </Card>
          ) : (
            <ul className="space-y-3">
              {residentsAtSlot.map(({ resident, meds }) => {
                const remaining = meds.filter((m) => !doses.has(doseKey(m.id, slot)));
                return (
                  <li key={resident.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-3 py-2">
                      <ResidentAvatar resident={resident} size="sm" />
                      <div className="min-w-0 flex-1">
                        <Link to={`/residentes/${resident.id}`} className="block truncate font-semibold text-slate-900 hover:text-brand-700">
                          {shortName(resident)}
                        </Link>
                        <p className="truncate text-xs text-slate-500">
                          {roomLabel(resident)}
                          {!siteId && ` · ${resident.site_name}`}
                        </p>
                      </div>
                      {remaining.length > 1 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => remaining.forEach((m) => record(resident, m, slot, 'GIVEN'))}
                        >
                          <CheckCheck className="size-4" /> Todo dado
                        </Button>
                      )}
                    </div>
                    <ul className="divide-y divide-slate-100">
                      {meds.map((m) => (
                        <DoseRow
                          key={m.id}
                          med={m}
                          dose={doses.get(doseKey(m.id, slot))}
                          busy={pending[doseKey(m.id, slot)]}
                          onGiven={() => record(resident, m, slot, 'GIVEN')}
                          onOther={(status) => setAskNote({ resident, med: m, time: slot, status })}
                          onUndo={(d) => undo(resident, d)}
                        />
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <NoteDialog
        target={askNote}
        onClose={() => setAskNote(null)}
        onConfirm={async (note) => {
          await record(askNote.resident, askNote.med, askNote.time, askNote.status, note);
          setAskNote(null);
        }}
      />
      <SosDialog
        target={sosDialog}
        isToday={isToday}
        onClose={() => setSosDialog(null)}
        onConfirm={async (time, note) => {
          await record(sosDialog.resident, sosDialog.med, time, 'GIVEN', note);
          setSosDialog(null);
        }}
      />
    </div>
  );
}

function DoseRow({ med, dose, busy, onGiven, onOther, onUndo }) {
  return (
    <li className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-900">
          <span className="font-semibold">{med.name}</span> · {med.dose}
        </p>
        {(med.schedule || med.instructions) && (
          <p className="text-xs text-slate-500">{[med.schedule, med.instructions].filter(Boolean).join(' · ')}</p>
        )}
      </div>
      {dose ? (
        <div className="flex items-center gap-2">
          <DoseStatus dose={dose} />
          <Button variant="ghost" size="icon" aria-label="Deshacer" disabled={busy} onClick={() => onUndo(dose)}>
            <RotateCcw className="size-4" />
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 sm:flex">
          <Button className="bg-accent-600 hover:bg-accent-700" loading={busy} onClick={onGiven}>
            <Check className="size-4" /> Dado
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => onOther('REFUSED')}>
            Rechazó
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => onOther('NOT_GIVEN')}>
            No se dio
          </Button>
        </div>
      )}
    </li>
  );
}

function DoseStatus({ dose }) {
  const s = DOSE_STATUS[dose.status];
  const at = new Date(dose.recorded_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
  return (
    <div className="text-right">
      <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', s.className)}>
        {dose.status === 'GIVEN' && <Check className="size-3.5" />}
        {s.label}
      </span>
      <p className="mt-0.5 text-[11px] text-slate-500">
        {at} · {dose.recorded_by?.split(' ')[0]}
        {dose.note && ` · ${dose.note}`}
      </p>
    </div>
  );
}

function SosList({ items, doses: residents, onRegister, onUndo, pending, showSite }) {
  const sosDoses = (resident, med) => resident.doses.filter((d) => d.medication_id === med.id);
  // Se toma el residente actualizado (con sus dosis al día) desde la lista
  const fresh = (r) => residents.find((x) => x.id === r.id) ?? r;

  return (
    <ul className="space-y-3">
      {items.map(({ resident: r0, med }) => {
        const resident = fresh(r0);
        const given = sosDoses(resident, med);
        return (
          <li key={med.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <ResidentAvatar resident={resident} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-900">
                    <span className="font-semibold">{shortName(resident)}</span>
                    <span className="text-slate-500">
                      {' '}
                      · {roomLabel(resident)}
                      {showSite && ` · ${resident.site_name}`}
                    </span>
                  </p>
                  <p className="text-sm text-slate-900">
                    {med.name} · {med.dose}
                  </p>
                  <MedicationTimes med={med} className="mt-1" />
                  {med.instructions && <p className="text-xs text-slate-500">{med.instructions}</p>}
                </div>
              </div>
              <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" onClick={() => onRegister({ resident, med })}>
                <SosBadge className="bg-transparent px-0 ring-0" /> Registrar dosis
              </Button>
            </div>
            {given.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2 border-t border-slate-100 pt-2">
                {given.map((d) => (
                  <li key={d.id} className="flex items-center gap-1">
                    <TimeChip time={d.time} />
                    <span className="text-xs text-slate-500">
                      {d.recorded_by?.split(' ')[0]}
                      {d.note && ` · ${d.note}`}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Deshacer"
                      className="size-7"
                      disabled={pending[doseKey(d.medication_id, d.time)]}
                      onClick={() => onUndo(resident, d)}
                    >
                      <RotateCcw className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function NoteDialog({ target, onClose, onConfirm }) {
  const id = useId();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => setNote(''), [target]);
  if (!target) return null;
  const label = DOSE_STATUS[target.status].label;

  return (
    <Dialog
      open
      onClose={saving ? undefined : onClose}
      title={`${label}: ${target.med.name}`}
      description={`${shortName(target.resident)} · ${target.time} ${periodOf(target.time)}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            loading={saving}
            onClick={async () => {
              setSaving(true);
              await onConfirm(note.trim() || null);
              setSaving(false);
            }}
          >
            Guardar
          </Button>
        </>
      }
    >
      <Field label="Motivo (opcional)" htmlFor={id}>
        <Input id={id} autoFocus maxLength={200} placeholder="Ej: estaba dormida · vomitó" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Dialog>
  );
}

function SosDialog({ target, isToday, onClose, onConfirm }) {
  const id = useId();
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setTime(isToday ? nowHHMM() : '');
    setNote('');
  }, [target, isToday]);
  if (!target) return null;

  return (
    <Dialog
      open
      onClose={saving ? undefined : onClose}
      title={`SOS: ${target.med.name} · ${target.med.dose}`}
      description={shortName(target.resident)}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            loading={saving}
            disabled={!time}
            onClick={async () => {
              setSaving(true);
              await onConfirm(time, note.trim() || null);
              setSaving(false);
            }}
          >
            Registrar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Hora en que se dio (24 h)" htmlFor={`${id}-time`}>
          <Input id={`${id}-time`} type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-36" />
        </Field>
        <Field label="Motivo (opcional)" htmlFor={`${id}-note`}>
          <Input id={`${id}-note`} maxLength={200} placeholder="Ej: agitación" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
