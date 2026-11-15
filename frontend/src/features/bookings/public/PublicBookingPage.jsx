import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CalendarCheck, CheckCircle2, Info, UserRound, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Input, PhoneInput, Select } from '@/components/ui/Form';
import { Alert, Spinner } from '@/components/ui/Feedback';
import { isValidLocalPhone } from '@/lib/phone';
import { cn } from '@/lib/utils';
import { MAX_FAMILY_NOTE, WARNING_NOTE, dayTitle, longDay, publicBookingsApi } from '../bookingsApi';
import { SlotPicker } from '../SlotPicker';
import { DocInput, docIsValid } from './DocInput';
import { PublicShell } from './PublicShell';

const EMPTY_VISITOR = { first_name: '', last_name: '', phone: '', site_id: '', resident_name: '' };
const STEPS = ['Aviso', 'Tus datos', 'A quién visitas', 'Día y hora'];

/** Reserva de visitas para familiares, sin login: /reservar */
export default function PublicBookingPage() {
  const [config, setConfig] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [step, setStep] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [doc, setDoc] = useState({ docType: 'RUT', docNumber: '' });
  const [lookup, setLookup] = useState(null); // { found, guardian, residents }
  const [residentId, setResidentId] = useState('');
  const [visitor, setVisitor] = useState(EMPTY_VISITOR);
  const [errors, setErrors] = useState({});
  const [availability, setAvailability] = useState(null);
  const [slot, setSlot] = useState({ date: null, start: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  useEffect(() => {
    publicBookingsApi
      .config()
      .then(setConfig)
      .catch((err) => setLoadError(err.message));
  }, []);

  const guardianResident = lookup?.found ? lookup.residents.find((r) => r.id === residentId) : null;
  const siteId = lookup?.found ? guardianResident?.site_id : Number(visitor.site_id) || null;
  const siteName = lookup?.found ? guardianResident?.site_name : config?.sites.find((s) => s.id === siteId)?.name;

  const loadAvailability = (id = siteId) => {
    setAvailability(null);
    return publicBookingsApi
      .availability(id)
      .then(setAvailability)
      .catch((err) => setError(err.message));
  };

  const go = (n) => {
    setError('');
    setStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  async function submitDoc(e) {
    e.preventDefault();
    if (!docIsValid(doc.docType, doc.docNumber)) {
      setErrors({ doc_number: doc.docType === 'RUT' ? 'RUT inválido: revisa los números y el dígito verificador' : 'Ingresa tu documento' });
      return;
    }
    setErrors({});
    setBusy(true);
    setError('');
    try {
      const result = doc.docType === 'RUT' ? await publicBookingsApi.lookup({ doc_type: 'RUT', doc_number: doc.docNumber }) : { found: false };
      setLookup(result);
      setResidentId(result.found && result.residents.length === 1 ? result.residents[0].id : '');
      go(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function submitWho(e) {
    e.preventDefault();
    const errs = {};
    if (lookup.found) {
      if (!residentId) errs.resident_id = 'Selecciona a quién visitas';
    } else {
      if (!visitor.first_name.trim()) errs.first_name = 'Ingresa tu nombre';
      if (!visitor.last_name.trim()) errs.last_name = 'Ingresa tu apellido';
      if (!isValidLocalPhone(visitor.phone)) errs.phone = 'Debe tener 9 dígitos';
      if (!visitor.site_id) errs.site_id = 'Selecciona la sede';
      if (visitor.resident_name.trim().split(/\s+/).filter((w) => w.length >= 2).length < 2) {
        errs.resident_name = 'Escribe el nombre y apellido del residente';
      }
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSlot({ date: null, start: null });
    loadAvailability();
    go(3);
  }

  async function book() {
    setBusy(true);
    setError('');
    try {
      const body = {
        doc_type: doc.docType,
        doc_number: doc.docNumber,
        date: slot.date,
        start: slot.start,
        accept_terms: true,
        ...(lookup.found
          ? { resident_id: residentId }
          : {
              first_name: visitor.first_name.trim(),
              last_name: visitor.last_name.trim(),
              phone: visitor.phone,
              site_id: Number(visitor.site_id),
              resident_name: visitor.resident_name.trim(),
            }),
      };
      setDone(await publicBookingsApi.create(body));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message);
      // Si alguien tomó el cupo justo antes, se refrescan los horarios
      if (err.status === 409) {
        setSlot((s) => ({ ...s, start: null }));
        loadAvailability();
      }
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <PublicShell title="Reservar visita">
        <Alert>{loadError}</Alert>
      </PublicShell>
    );
  }
  if (!config) {
    return (
      <PublicShell title="Reservar visita">
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      </PublicShell>
    );
  }
  if (!config.enabled) {
    return (
      <PublicShell title="Reservar visita">
        <p className="text-center text-slate-600">Las reservas en línea no están disponibles por ahora. Comunícate con la residencia para agendar tu visita.</p>
      </PublicShell>
    );
  }

  if (done) {
    return (
      <PublicShell title="¡Visita reservada!">
        <div className="space-y-5 text-center">
          <CheckCircle2 className="mx-auto size-14 text-accent-600" />
          <div>
            <p className="text-sm text-slate-500">Tu código de reserva</p>
            <p className="mt-1 font-mono text-4xl font-bold tracking-[0.3em] text-brand-800">{done.code}</p>
            <p className="mt-2 text-xs text-slate-500">Guárdalo (sácale una foto a esta pantalla): lo necesitas para cancelar.</p>
          </div>
          <dl className="space-y-2 rounded-xl bg-slate-50 p-4 text-left text-sm">
            <Row label="Visita a">{done.resident_label}</Row>
            <Row label="Sede">{done.site_name}</Row>
            <Row label="Día">
              {dayTitle(done.date)}
            </Row>
            <Row label="Horario">
              {done.start} – {done.end}
            </Row>
          </dl>
          <p className="flex items-start gap-2 rounded-xl bg-brand-50 p-3 text-left text-sm text-brand-800">
            <Users className="mt-0.5 size-4 shrink-0" /> {MAX_FAMILY_NOTE}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Hacer otra reserva
            </Button>
            <Link to="/reservar/cancelar" className="inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm text-slate-600 hover:bg-slate-100">
              Cancelar una reserva
            </Link>
          </div>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell title="Reservar visita">
      <ol className="mb-5 flex items-center gap-1.5" aria-label="Pasos">
        {STEPS.map((label, i) => (
          <li key={label} className="flex-1">
            <div className={cn('h-1.5 rounded-full', i <= step ? 'bg-brand-600' : 'bg-slate-200')} />
            <p className={cn('mt-1 hidden text-[11px] sm:block', i === step ? 'font-medium text-brand-700' : 'text-slate-400')}>{label}</p>
          </li>
        ))}
      </ol>

      {step > 0 && (
        <button type="button" onClick={() => go(step - 1)} className="mb-3 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="size-4" /> Volver
        </button>
      )}

      <Alert className="mb-4">{error}</Alert>

      {step === 0 && (
        <div className="space-y-4">
          <p className="text-slate-700">
            Reserva aquí tu visita a la residencia. Las visitas se agendan <strong>con al menos un día de anticipación</strong> (hasta las{' '}
            {config.cutoff_time} del día anterior) y hasta {config.days_ahead} días más.
          </p>
          {config.limits && (
            <p className="text-sm text-slate-600">
              Cada persona puede reservar <strong>{config.limits.per_person_day === 1 ? '1 visita' : `${config.limits.per_person_day} visitas`} al día</strong> y
              hasta <strong>{config.limits.per_person_week} en la semana</strong>, para que todas las familias tengan horario.
            </p>
          )}
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <p>{WARNING_NOTE}</p>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
            <input type="checkbox" className="mt-0.5 size-4 accent-brand-600" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            <span>
              Entiendo y acepto. Mis datos se usarán solo para gestionar la visita (
              <Link to="/reservar/privacidad" className="text-brand-700 underline">
                ver privacidad
              </Link>
              ).
            </span>
          </label>
          <Button size="lg" className="w-full" disabled={!accepted} onClick={() => go(1)}>
            Comenzar
          </Button>
        </div>
      )}

      {step === 1 && (
        <form onSubmit={submitDoc} className="space-y-4" noValidate>
          <DocInput
            docType={doc.docType}
            docNumber={doc.docNumber}
            error={errors.doc_number}
            onChange={(next) => {
              setErrors({});
              setDoc(next);
            }}
          />
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Continuar
          </Button>
        </form>
      )}

      {step === 2 && lookup?.found && (
        <form onSubmit={submitWho} className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-accent-50 p-4 text-sm text-accent-900 ring-1 ring-accent-200">
            <UserRound className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-semibold">Hola, {lookup.guardian.display_name}</p>
              <p className="mt-0.5 text-accent-800">
                {[lookup.guardian.email, lookup.guardian.phone].filter(Boolean).join(' · ')}
              </p>
              <p className="mt-1 text-xs text-accent-700">Si tus datos cambiaron, avísale a la residencia.</p>
            </div>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-700">¿A quién visitas?</legend>
            {lookup.residents.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">No tienes residentes activos asociados. Comunícate con la residencia.</p>
            ) : (
              <div className="space-y-2">
                {lookup.residents.map((r) => (
                  <label
                    key={r.id}
                    className={cn(
                      'flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 transition',
                      residentId === r.id ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-500/30' : 'border-slate-200 hover:bg-slate-50',
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <input type="radio" name="resident" className="size-4 accent-brand-600" checked={residentId === r.id} onChange={() => setResidentId(r.id)} />
                      <span className="font-medium text-slate-900">{r.label}</span>
                    </span>
                    <span className="text-xs text-slate-500">Sede {r.site_name}</span>
                  </label>
                ))}
              </div>
            )}
            {errors.resident_id && <p className="mt-1 text-xs text-red-600">{errors.resident_id}</p>}
          </fieldset>
          <Button type="submit" size="lg" className="w-full" disabled={lookup.residents.length === 0}>
            Elegir día y hora
          </Button>
        </form>
      )}

      {step === 2 && lookup && !lookup.found && (
        <form onSubmit={submitWho} className="space-y-4" noValidate>
          {/* Mensaje neutro: no se revela si el RUT está o no registrado (protección de datos) */}
          <p className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            <Info className="mt-0.5 size-4 shrink-0" /> Completa tus datos para reservar.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre" htmlFor="first_name" error={errors.first_name}>
              <Input id="first_name" className="h-11" autoComplete="given-name" value={visitor.first_name} onChange={setField(setVisitor, 'first_name')} />
            </Field>
            <Field label="Apellido" htmlFor="last_name" error={errors.last_name}>
              <Input id="last_name" className="h-11" autoComplete="family-name" value={visitor.last_name} onChange={setField(setVisitor, 'last_name')} />
            </Field>
          </div>
          <Field label="Teléfono" htmlFor="phone" error={errors.phone}>
            <PhoneInput id="phone" className="h-11" value={visitor.phone} onChange={(digits) => setVisitor((v) => ({ ...v, phone: digits }))} invalid={!!errors.phone} />
          </Field>
          <Field label="Sede" htmlFor="site_id" error={errors.site_id}>
            <Select id="site_id" className="h-11" value={visitor.site_id} onChange={setField(setVisitor, 'site_id')}>
              <option value="">Selecciona…</option>
              {config.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nombre y apellido del residente que visitas" htmlFor="resident_name" error={errors.resident_name} hint="Tal como lo conoces, ej: María González">
            <Input id="resident_name" className="h-11" autoComplete="off" value={visitor.resident_name} onChange={setField(setVisitor, 'resident_name')} />
          </Field>
          <Button type="submit" size="lg" className="w-full">
            Elegir día y hora
          </Button>
        </form>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <p className="text-sm text-slate-600">
            Visita a <strong>{lookup.found ? guardianResident?.label : visitor.resident_name}</strong> · Sede {siteName}
          </p>
          {!availability ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <SlotPicker days={availability.days} date={slot.date} start={slot.start} onChange={setSlot} />
          )}
          <p className="flex items-start gap-2 rounded-xl bg-brand-50 p-3 text-sm text-brand-800">
            <Users className="mt-0.5 size-4 shrink-0" /> {MAX_FAMILY_NOTE}
          </p>
          <Button size="lg" className="w-full" disabled={!slot.start} loading={busy} onClick={book}>
            <CalendarCheck className="size-5" />
            {slot.start ? `Reservar ${slot.start} del ${longDay(slot.date)}` : 'Elige día y horario'}
          </Button>
        </div>
      )}
    </PublicShell>
  );
}

const setField = (setter, key) => (e) => setter((v) => ({ ...v, [key]: e.target.value }));

function Row({ label, children }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{children}</dd>
    </div>
  );
}
