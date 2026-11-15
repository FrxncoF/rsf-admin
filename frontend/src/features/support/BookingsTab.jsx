import { useEffect, useState } from 'react';
import { CalendarX, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Form';
import { Alert, Spinner } from '@/components/ui/Feedback';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { dayTitle } from '@/features/bookings/bookingsApi';

/** Configuración de la página pública de reservas: bloques, cupos, hora límite y días bloqueados. */
const DEFAULT_LIMITS = { per_person_day: 1, per_person_week: 3, per_resident_day: 2 };
const toBody = ({ enabled, cutoff_time, days_ahead, blocks, blocked_dates, limits }) => ({
  enabled,
  cutoff_time,
  days_ahead: Number(days_ahead),
  limits: Object.fromEntries(Object.entries({ ...DEFAULT_LIMITS, ...limits }).map(([k, v]) => [k, Number(v)])),
  blocks,
  blocked_dates,
});
// Solo lo que se guarda con el botón (los días sin visitas se guardan al instante)
const draftKey = (v) => JSON.stringify({ ...toBody(v), blocked_dates: undefined });

export function BookingsTab() {
  const [server, setServer] = useState(null); // lo que está guardado
  const [values, setValues] = useState(null); // borrador en pantalla
  const [error, setError] = useState('');
  const [details, setDetails] = useState({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newDate, setNewDate] = useState({ date: '', reason: '' });
  const [dateError, setDateError] = useState('');
  const [savingDates, setSavingDates] = useState(false);

  useEffect(() => {
    api
      .get('/support/settings/bookings')
      .then(({ data }) => {
        setServer(data);
        setValues(data);
      })
      .catch((err) => setError(err.message));
  }, []);

  const dirty = Boolean(server && values) && draftKey(server) !== draftKey(values);
  // Aviso del navegador si se intenta salir con cambios sin guardar
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  if (!values) return error ? <Alert>{error}</Alert> : <Spinner />;

  const update = (patch) => {
    setSaved(false);
    setValues((v) => ({ ...v, ...patch }));
  };
  const setBlock = (i, patch) => update({ blocks: values.blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)) });

  async function save() {
    setSaving(true);
    setError('');
    setDetails({});
    try {
      const { data } = await api.put('/support/settings/bookings', toBody(values));
      setServer(data);
      setValues(data);
      setSaved(true);
    } catch (err) {
      setError(err.message);
      setDetails(err.details ?? {});
    } finally {
      setSaving(false);
    }
  }

  /** Días sin visitas: se guardan de inmediato sobre la configuración guardada (no arrastra borradores). */
  async function saveBlockedDates(list) {
    setSavingDates(true);
    setDateError('');
    try {
      const { data } = await api.put('/support/settings/bookings', { ...toBody(server), blocked_dates: list });
      setServer(data);
      setValues((v) => ({ ...v, blocked_dates: data.blocked_dates }));
      return true;
    } catch (err) {
      setDateError(Object.values(err.details ?? {})[0] ? `${err.message}: ${Object.values(err.details)[0]}` : err.message);
      return false;
    } finally {
      setSavingDates(false);
    }
  }

  const detailList = Object.entries(details).map(([k, v]) => `${k.replace('blocks.', 'Bloque ').replace('blocked_dates', 'Días bloqueados')}: ${v}`);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Visitas · página pública de reservas</CardTitle>
          <p className="text-sm text-slate-500">
            Los familiares reservan en{' '}
            <a href="/reservar" target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">
              /reservar
            </a>
            . Los bloques y cupos son iguales en ambas sedes; el cupo se cuenta por sede.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-3 text-sm font-medium text-slate-800">
            <input type="checkbox" className="size-4 accent-brand-600" checked={values.enabled} onChange={(e) => update({ enabled: e.target.checked })} />
            Reservas en línea activas
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Hora límite del día anterior" htmlFor="cutoff" hint="Después de esta hora ya no se puede reservar para mañana">
              <Input id="cutoff" type="time" value={values.cutoff_time} onChange={(e) => update({ cutoff_time: e.target.value })} />
            </Field>
            <Field label="Días hacia adelante" htmlFor="days_ahead" hint="Hasta cuántos días se puede reservar">
              <Input id="days_ahead" type="number" min={1} max={60} value={values.days_ahead} onChange={(e) => update({ days_ahead: e.target.value })} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Límites por familia</CardTitle>
          <p className="text-sm text-slate-500">
            Se aplican en la página pública. Una persona es el mismo RUT/documento o el mismo teléfono. Cancelar o rechazar una reserva libera el
            cupo. El equipo puede agendar por sobre estos límites.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ['per_person_day', 'Visitas por persona al día', 'Ej: 1 = una visita diaria'],
              ['per_person_week', 'Visitas por persona en la semana', 'Reservas vigentes a futuro'],
              ['per_resident_day', 'Visitas por residente al día', 'Solo con apoderados registrados'],
            ].map(([key, label, hint]) => (
              <Field key={key} label={label} htmlFor={`lim_${key}`} hint={hint}>
                <Input
                  id={`lim_${key}`}
                  type="number"
                  min={1}
                  max={30}
                  value={(values.limits ?? DEFAULT_LIMITS)[key]}
                  onChange={(e) => update({ limits: { ...DEFAULT_LIMITS, ...values.limits, [key]: e.target.value } })}
                />
              </Field>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bloques horarios</CardTitle>
          <p className="text-sm text-slate-500">Cupo 1 = una familia por bloque · Cupo 2 = bloque doble. Desactivar un bloque no borra sus reservas.</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {values.blocks.map((b, i) => (
            <div key={i} className={cn('grid grid-cols-[1fr_1fr_auto] items-end gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_8rem_auto_auto]', !b.active && 'bg-slate-50 opacity-70')}>
              <Field label="Inicio" htmlFor={`b${i}s`}>
                <Input id={`b${i}s`} type="time" value={b.start} onChange={(e) => setBlock(i, { start: e.target.value })} />
              </Field>
              <Field label="Término" htmlFor={`b${i}e`}>
                <Input id={`b${i}e`} type="time" value={b.end} onChange={(e) => setBlock(i, { end: e.target.value })} />
              </Field>
              <Field label="Cupo" htmlFor={`b${i}c`}>
                <Select id={`b${i}c`} value={b.capacity} onChange={(e) => setBlock(i, { capacity: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? '1 (simple)' : n === 2 ? '2 (doble)' : n}
                    </option>
                  ))}
                </Select>
              </Field>
              <label className="flex h-10 items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" className="size-4 accent-brand-600" checked={b.active} onChange={(e) => setBlock(i, { active: e.target.checked })} /> Activo
              </label>
              <Button variant="ghost" size="icon" aria-label="Quitar bloque" onClick={() => update({ blocks: values.blocks.filter((_, j) => j !== i) })}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => update({ blocks: [...values.blocks, { start: '17:00', end: '18:00', capacity: 1, active: true }] })}
          >
            <Plus className="size-4" /> Agregar bloque
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Días sin visitas</CardTitle>
          <p className="text-sm text-slate-500">
            Feriados, brotes u otros días en que no se reciben visitas. <strong>Se guardan al instante.</strong> Las visitas ya agendadas ese día no
            se cancelan solas: aparecen en el panel de Visitas para llamar a las familias.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {values.blocked_dates.length === 0 ? (
            <p className="text-sm text-slate-400">Ninguno</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {values.blocked_dates.map((d) => (
                <li key={d.date} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span>
                    <CalendarX className="mr-1.5 inline size-4 text-slate-400" />
                    <span className="font-medium">{dayTitle(d.date)}</span> {d.reason && <span className="text-slate-500">· {d.reason}</span>}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Quitar día"
                    disabled={savingDates}
                    onClick={() => saveBlockedDates(values.blocked_dates.filter((x) => x.date !== d.date))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field label="Día" htmlFor="bd_date">
              <Input id="bd_date" type="date" value={newDate.date} onChange={(e) => setNewDate((n) => ({ ...n, date: e.target.value }))} />
            </Field>
            <Field label="Motivo" htmlFor="bd_reason" className="flex-1">
              <Input id="bd_reason" maxLength={80} placeholder="Ej: Navidad" value={newDate.reason} onChange={(e) => setNewDate((n) => ({ ...n, reason: e.target.value }))} />
            </Field>
            <Button
              variant="outline"
              disabled={!newDate.date}
              loading={savingDates}
              onClick={async () => {
                const list = [...values.blocked_dates.filter((d) => d.date !== newDate.date), { date: newDate.date, reason: newDate.reason.trim() }];
                if (await saveBlockedDates(list)) setNewDate({ date: '', reason: '' });
              }}
            >
              <Plus className="size-4" /> Bloquear día
            </Button>
          </div>
          <Alert>{dateError}</Alert>
        </CardContent>
      </Card>

      <Alert>{error && [error, ...detailList].join(' · ')}</Alert>
      <div className="flex items-center justify-end gap-3">
        {dirty && <span className="text-sm font-medium text-amber-700">Tienes cambios sin guardar</span>}
        {saved && !dirty && <span className="text-sm text-accent-700">Guardado ✓</span>}
        <Button onClick={save} loading={saving}>
          <Save className="size-4" /> Guardar configuración
        </Button>
      </div>
    </div>
  );
}
