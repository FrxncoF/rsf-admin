import { useCallback, useEffect, useState } from 'react';
import { Megaphone, Plus, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Form';
import { Alert, Spinner } from '@/components/ui/Feedback';
import { useAppConfig } from '@/features/app-config/AppConfigContext';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const TONES = [
  { value: 'info', label: 'Informativo (azul)', className: 'bg-brand-600 text-white' },
  { value: 'success', label: 'Positivo (verde)', className: 'bg-accent-600 text-white' },
  { value: 'warning', label: 'Advertencia (ámbar)', className: 'bg-amber-400 text-amber-950' },
  { value: 'danger', label: 'Urgente (rojo)', className: 'bg-red-600 text-white' },
];

/** "Cruz Blanca" → "CRUZ_BLANCA" (código interno, no cambia después de creado) */
const toCode = (label) =>
  label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 30);

export function ConfigTab() {
  const { reload } = useAppConfig();
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api
      .get('/support/settings')
      .then(({ data }) => setSettings(data))
      .catch((err) => setError(err.message));
  }, []);
  useEffect(load, [load]);

  if (!settings) return error ? <Alert>{error}</Alert> : <Spinner />;

  const onSaved = () => {
    load();
    reload();
  };

  return (
    <div className="space-y-4">
      <BannerEditor initial={settings.banner} onSaved={onSaved} />
      <div className="grid gap-4 lg:grid-cols-2">
        <CatalogEditor name="isapres" title="Isapres (y Dipreca / Capredena)" initial={settings.isapres} onSaved={onSaved} />
        <CatalogEditor name="ambulances" title="Servicios de ambulancia" initial={settings.ambulances} onSaved={onSaved} />
      </div>
    </div>
  );
}

function BannerEditor({ initial, onSaved }) {
  const [values, setValues] = useState({ enabled: false, message: '', tone: 'info', dismissible: true, ...initial });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ error: '', ok: '' });
  const tone = TONES.find((t) => t.value === values.tone) ?? TONES[0];

  async function save() {
    setSaving(true);
    setFeedback({ error: '', ok: '' });
    try {
      const { enabled, message, tone: t, dismissible } = values;
      await api.put('/support/settings/banner', { enabled, message, tone: t, dismissible });
      setFeedback({ error: '', ok: enabled ? 'Aviso publicado para todos.' : 'Aviso desactivado.' });
      onSaved();
    } catch (err) {
      setFeedback({ error: err.details?.message ?? err.message, ok: '' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Megaphone className="size-4 text-brand-600" /> Aviso superior
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>{feedback.error}</Alert>
        {feedback.ok && <p className="rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-800 ring-1 ring-accent-200">{feedback.ok}</p>}
        <Field label="Mensaje" htmlFor="banner_msg" hint={`${values.message.length}/300`}>
          <Input
            id="banner_msg"
            maxLength={300}
            placeholder="Ej: Actualizando el sistema, vuelve en 10 minutos"
            value={values.message}
            onChange={(e) => setValues((v) => ({ ...v, message: e.target.value }))}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Color" htmlFor="banner_tone">
            <Select id="banner_tone" value={values.tone} onChange={(e) => setValues((v) => ({ ...v, tone: e.target.value }))}>
              {TONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="space-y-2 pt-1 text-sm text-slate-700">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-brand-600"
                checked={values.dismissible}
                onChange={(e) => setValues((v) => ({ ...v, dismissible: e.target.checked }))}
              />
              Los usuarios pueden cerrarlo con la X
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-brand-600"
                checked={values.enabled}
                onChange={(e) => setValues((v) => ({ ...v, enabled: e.target.checked }))}
              />
              Mostrar el aviso
            </label>
          </div>
        </div>
        {values.message && (
          <div>
            <p className="mb-1 text-xs text-slate-500">Vista previa</p>
            <div className={cn('rounded-lg px-4 py-2 text-center text-sm font-medium', tone.className)}>{values.message}</div>
          </div>
        )}
        <p className="text-xs text-slate-500">
          Si es descartable, quien lo cierre no lo verá de nuevo hasta que guardes un cambio. Si no, queda fijo hasta que lo desactives.
        </p>
        <Button onClick={save} loading={saving}>
          <Save className="size-4" /> Guardar aviso
        </Button>
      </CardContent>
    </Card>
  );
}

function CatalogEditor({ name, title, initial, onSaved }) {
  const [items, setItems] = useState(initial);
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ error: '', ok: '' });
  const originalCodes = new Set(initial.map((i) => i.value));

  const update = (index, patch) => setItems((list) => list.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  function add() {
    const label = newLabel.trim();
    const value = toCode(label);
    if (value.length < 2) return setFeedback({ error: 'Nombre demasiado corto', ok: '' });
    if (items.some((i) => i.value === value)) return setFeedback({ error: 'Ya existe una opción con ese nombre', ok: '' });
    setItems((list) => [...list, { value, label, active: true }]);
    setNewLabel('');
    setFeedback({ error: '', ok: '' });
  }

  async function save() {
    setSaving(true);
    setFeedback({ error: '', ok: '' });
    try {
      await api.put(`/support/settings/${name}`, items);
      setFeedback({ error: '', ok: 'Guardado.' });
      onSaved();
    } catch (err) {
      setFeedback({ error: err.message, ok: '' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Alert>{feedback.error}</Alert>
        {feedback.ok && <p className="rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-800 ring-1 ring-accent-200">{feedback.ok}</p>}
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {items.map((item, i) => (
            <li key={item.value} className={cn('flex items-center gap-2 px-3 py-2', !item.active && 'bg-slate-50')}>
              <Input
                value={item.label}
                maxLength={60}
                onChange={(e) => update(i, { label: e.target.value })}
                className={cn('h-9', !item.active && 'text-slate-400')}
                aria-label={`Nombre de ${item.value}`}
              />
              <span className="hidden w-28 shrink-0 truncate font-mono text-[10px] text-slate-400 sm:block" title="Código interno">
                {item.value}
              </span>
              <label className="flex shrink-0 items-center gap-1.5 text-xs text-slate-600">
                <input type="checkbox" className="size-4 accent-brand-600" checked={item.active} onChange={(e) => update(i, { active: e.target.checked })} />
                Activa
              </label>
              {!originalCodes.has(item.value) && (
                <button type="button" onClick={() => setItems((list) => list.filter((_, j) => j !== i))} className="text-xs text-red-600 hover:underline">
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input
            placeholder="Nueva opción"
            maxLength={60}
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          />
          <Button variant="outline" onClick={add} disabled={!newLabel.trim()}>
            <Plus className="size-4" /> Agregar
          </Button>
        </div>
        <p className="text-xs text-slate-500">Las opciones guardadas no se borran (hay residentes que las usan): desactívalas para ocultarlas.</p>
        <Button onClick={save} loading={saving}>
          <Save className="size-4" /> Guardar
        </Button>
      </CardContent>
    </Card>
  );
}
