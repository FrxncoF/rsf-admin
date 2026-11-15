import { useEffect, useState } from 'react';
import { Plus, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, PhoneInput } from '@/components/ui/Form';
import { Alert, Spinner } from '@/components/ui/Feedback';
import { residentsApi } from '@/features/residents/residentsApi';
import { ResidentAvatar } from '@/features/residents/ResidentAvatar';
import { isValidLocalPhone } from '@/lib/phone';
import { cn, roomLabel } from '@/lib/utils';
import { bookingsApi } from './bookingsApi';
import { ResidentSearch } from './ResidentSearch';
import { SlotPicker } from './SlotPicker';

const OTHER = 'other';

/**
 * Agendar una visita desde el panel (por teléfono o en persona): residente con buscador y foto,
 * quién visita (uno de sus apoderados u otra persona) y día + bloque. Puede ser para hoy y sin hora límite.
 */
export function StaffVisitDialog({ defaultSiteId, onClose, onSaved }) {
  const [values, setValues] = useState({ resident: null, visitor: '', visitor_name: '', relationship: '', phone: '' });
  const [guardians, setGuardians] = useState({ list: [], loading: false });
  const [availability, setAvailability] = useState(null);
  const [slot, setSlot] = useState({ date: null, start: null });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (patch) => {
    setValues((v) => ({ ...v, ...patch }));
    setErrors((errs) => ({ ...errs, ...Object.fromEntries(Object.keys(patch).map((k) => [k, undefined])) }));
  };

  // Apoderados y cupos del residente elegido (los cupos dependen de su sede)
  const resident = values.resident;
  useEffect(() => {
    setAvailability(null);
    setSlot({ date: null, start: null });
    if (!resident) return undefined;
    let alive = true;
    setGuardians({ list: [], loading: true });
    residentsApi
      .get(resident.id)
      .then((r) => alive && setGuardians({ list: r.guardians ?? [], loading: false }))
      .catch(() => alive && setGuardians({ list: [], loading: false }));
    bookingsApi
      .availability(resident.site_id)
      .then((a) => alive && setAvailability(a))
      .catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, [resident]);

  async function save() {
    const errs = {};
    if (!resident) errs.resident_id = 'Busca y selecciona el residente';
    if (!values.visitor) errs.visitor = 'Indica quién visita';
    if (values.visitor === OTHER && !values.visitor_name.trim()) errs.visitor_name = 'Escribe el nombre';
    if (values.visitor === OTHER && values.phone && !isValidLocalPhone(values.phone)) errs.phone = 'Debe tener 9 dígitos';
    if (!slot.start) errs.slot = 'Elige el día y el bloque';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setError('');
    try {
      const saved = await bookingsApi.create({
        resident_id: resident.id,
        ...(values.visitor === OTHER
          ? { visitor_name: values.visitor_name.trim(), relationship: values.relationship.trim() || null, phone: values.phone || null }
          : { guardian_id: values.visitor }),
        date: slot.date,
        start: slot.start,
      });
      onSaved(saved);
    } catch (err) {
      setError(err.message);
      if (err.status === 409) bookingsApi.availability(resident.site_id).then(setAvailability);
    } finally {
      setBusy(false);
    }
  }

  const visitorOptions = [
    ...guardians.list.map((g) => ({ value: g.id, label: g.full_name, hint: g.relationship })),
    { value: OTHER, label: 'Otra persona', hint: 'Familiar o amigo' },
  ];

  return (
    <Dialog
      open
      onClose={busy ? undefined : onClose}
      title="Agendar visita"
      description="Por teléfono o en persona. Queda confirmada de inmediato y puede ser para hoy."
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={save} loading={busy}>
            Agendar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Alert>{error}</Alert>

        <Field label="Residente" htmlFor="sv_resident" error={errors.resident_id}>
          {resident ? (
            <div className="flex items-center gap-3 rounded-lg border-2 border-brand-500 bg-brand-50 px-3 py-2.5">
              <ResidentAvatar resident={resident} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {resident.first_name} {resident.last_name}
                </p>
                <p className="truncate text-xs text-slate-600">
                  Sede <span className="font-medium">{resident.site_name}</span> · {roomLabel(resident)}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => set({ resident: null, visitor: '' })}>
                Cambiar
              </Button>
            </div>
          ) : (
            <ResidentSearch
              inputId="sv_resident"
              siteId={defaultSiteId}
              invalid={!!errors.resident_id}
              onSelect={(r) => set({ resident: r, resident_id: undefined, visitor: '' })}
            />
          )}
        </Field>

        {resident && (
          <Field label="¿Quién visita?" error={errors.visitor}>
            {guardians.loading ? (
              <Spinner className="size-5" />
            ) : (
              <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
                {visitorOptions.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={values.visitor === o.value}
                    onClick={() => set({ visitor: o.value })}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition',
                      values.visitor === o.value
                        ? 'border-2 border-brand-500 bg-brand-50 text-brand-900'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    {o.value === OTHER ? <Plus className="size-4 shrink-0" /> : <UserRound className="size-4 shrink-0" />}
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{o.label}</span>
                      {o.hint && <span className="block text-xs text-slate-500">{o.hint}</span>}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Field>
        )}

        {values.visitor === OTHER && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Nombre" htmlFor="sv_name" error={errors.visitor_name}>
              <Input
                id="sv_name"
                maxLength={120}
                value={values.visitor_name}
                onChange={(e) => set({ visitor_name: e.target.value })}
                aria-invalid={!!errors.visitor_name}
              />
            </Field>
            <Field label="Relación (opcional)" htmlFor="sv_rel">
              <Input id="sv_rel" maxLength={40} placeholder="Ej: Nieta, Amiga" value={values.relationship} onChange={(e) => set({ relationship: e.target.value })} />
            </Field>
            <Field label="Teléfono (opcional)" htmlFor="sv_phone" error={errors.phone} hint="Para avisarle si hay cambios">
              <PhoneInput id="sv_phone" value={values.phone} onChange={(digits) => set({ phone: digits })} invalid={!!errors.phone} />
            </Field>
          </div>
        )}

        {resident && (
          <div>
            {availability ? (
              <SlotPicker
                days={availability.days}
                date={slot.date}
                start={slot.start}
                onChange={(s) => {
                  setSlot(s);
                  setErrors((e) => ({ ...e, slot: undefined }));
                }}
              />
            ) : (
              <Spinner />
            )}
            {errors.slot && <p className="mt-1 text-xs text-red-600">{errors.slot}</p>}
          </div>
        )}
      </div>
    </Dialog>
  );
}
