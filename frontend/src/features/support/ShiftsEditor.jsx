import { useEffect, useState } from 'react';
import { Clock, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Form';
import { Alert, Spinner } from '@/components/ui/Feedback';
import { api } from '@/lib/api';

/** Horarios de los turnos: definen cuándo se abre y se cierra cada ficha del turno. */
export function ShiftsEditor() {
  const [values, setValues] = useState(null);
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get('/support/settings/shifts')
      .then(({ data }) => {
        const withDefault = { edit_grace_hours: 1, ...data };
        setValues(withDefault);
        setSaved(withDefault);
      })
      .catch((err) => setError(err.message));
  }, []);

  if (!values) return error ? <Alert>{error}</Alert> : <Spinner />;
  const dirty = ['day_start', 'night_start', 'edit_grace_hours'].some((k) => String(values[k]) !== String(saved[k]));

  async function save() {
    setSaving(true);
    setError('');
    try {
      const { data } = await api.put('/support/settings/shifts', {
        day_start: values.day_start,
        night_start: values.night_start,
        edit_grace_hours: Number(values.edit_grace_hours),
      });
      setValues(data);
      setSaved(data);
    } catch (err) {
      setError(Object.values(err.details ?? {})[0] ?? err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-5 text-brand-600" /> Turnos de las fichas
        </CardTitle>
        <p className="text-sm text-slate-500">
          Cada residente tiene una ficha por turno. Al terminar el turno queda {Number(values.edit_grace_hours) || 0} h para completarla y después se
          cierra para todos. Turno día: de {values.day_start} a {values.night_start} · Turno
          noche: de {values.night_start} a {values.day_start} del día siguiente.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Inicio turno día" htmlFor="day_start">
            <Input id="day_start" type="time" value={values.day_start} onChange={(e) => setValues((v) => ({ ...v, day_start: e.target.value }))} />
          </Field>
          <Field label="Inicio turno noche" htmlFor="night_start">
            <Input id="night_start" type="time" value={values.night_start} onChange={(e) => setValues((v) => ({ ...v, night_start: e.target.value }))} />
          </Field>
          <Field label="Margen para completar" htmlFor="grace" hint="Horas después del turno (0 = se cierra al tiro)">
            <Input
              id="grace"
              type="number"
              min={0}
              max={12}
              step={1}
              value={values.edit_grace_hours}
              onChange={(e) => setValues((v) => ({ ...v, edit_grace_hours: e.target.value }))}
            />
          </Field>
        </div>
        <p className="text-xs text-slate-500">El cambio rige desde el próximo guardado: las fichas ya abiertas se cierran según el nuevo horario.</p>
        <Alert>{error}</Alert>
        <div className="flex items-center justify-end gap-3">
          {dirty && <span className="text-sm font-medium text-amber-700">Cambios sin guardar</span>}
          <Button onClick={save} loading={saving} disabled={!dirty}>
            <Save className="size-4" /> Guardar turnos
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
