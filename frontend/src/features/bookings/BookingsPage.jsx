import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Check, ChevronLeft, ChevronRight, ExternalLink, Phone, Plus, ShieldAlert, ShieldCheck, ShieldQuestion, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input } from '@/components/ui/Form';
import { Alert, EmptyState, Spinner } from '@/components/ui/Feedback';
import { useSites } from '@/features/sites/SiteContext';
import { formatPhone, phoneHref } from '@/lib/phone';
import { formatRut } from '@/lib/rut';
import { cn, roomLabel } from '@/lib/utils';
import { BOOKING_STATUS, addDays, bookingsApi, dayTitle, shortDay } from './bookingsApi';
import { StaffVisitDialog } from './StaffVisitDialog';
import { ROOM_PENDING } from '@/features/residents/constants';

const ACTIVE = ['BOOKED', 'CONFIRMED'];

/** Visitas del día por bloques: las que reservan las familias (/reservar) y las que agenda el equipo. */
export default function BookingsPage() {
  const { siteId, currentSite } = useSites();
  const [date, setDate] = useState(null); // null = hoy (lo define el servidor)
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const [toReject, setToReject] = useState(null);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    bookingsApi
      .day({ site_id: siteId ?? undefined, date: date ?? undefined })
      .then((data) => setState({ data, loading: false, error: '' }))
      .catch((err) => setState((s) => ({ ...s, loading: false, error: err.message })));
  }, [siteId, date]);
  useEffect(load, [load]);

  async function confirm(booking) {
    setActionError('');
    try {
      await bookingsApi.confirm(booking.id);
      load();
    } catch (err) {
      setActionError(err.message);
    }
  }

  const data = state.data;
  const groups = data ? groupBySlot(data) : [];
  const pendingOther = data?.pending.filter((p) => p.date !== data.date) ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Visitas</h1>
          <p className="mt-1 text-sm text-slate-500">
            {currentSite ? `Sede ${currentSite.name}` : 'Todas las sedes'} ·{' '}
            <a href="/reservar" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
              página para familias <ExternalLink className="size-3" />
            </a>
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" /> Agendar visita
        </Button>
      </div>

      {data && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Día anterior" onClick={() => setDate(addDays(data.date, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Input type="date" className="w-auto" value={data.date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Día" />
          <Button variant="outline" size="icon" aria-label="Día siguiente" onClick={() => setDate(addDays(data.date, 1))}>
            <ChevronRight className="size-4" />
          </Button>
          {data.date !== data.today && (
            <Button variant="ghost" size="sm" onClick={() => setDate(null)}>
              Hoy
            </Button>
          )}
          <p className="ml-1 text-sm font-medium text-slate-700">
            {dayTitle(data.date)}
            {data.date === data.today && <span className="normal-case text-slate-400"> · hoy</span>}
          </p>
        </div>
      )}

      {pendingOther.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <ShieldAlert className="size-4" /> Por revisar en otros días:
          {pendingOther.map((p) => {
            const [wd, num] = shortDay(p.date);
            return (
              <button key={p.date} type="button" onClick={() => setDate(p.date)} className="rounded-lg bg-white px-2 py-0.5 font-medium ring-1 ring-amber-200 hover:bg-amber-100">
                {wd} {num} ({p.n})
              </button>
            );
          })}
        </div>
      )}

      <Alert>{state.error || actionError}</Alert>

      {!data ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <div className={cn('space-y-4', state.loading && 'opacity-60 transition-opacity')}>
          {data.blocked && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">
              <strong>Día sin visitas:</strong> {data.blocked}.
              {data.bookings.some((b) => ACTIVE.includes(b.status)) && ' Hay visitas agendadas: llama a las familias y recházalas.'}
            </p>
          )}
          {groups.length === 0 ? (
            <Card>
              <EmptyState icon={CalendarClock} title="Sin reservas este día" />
            </Card>
          ) : (
            groups.map((g) => (
              <section key={g.start} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-2">
                  <h2 className="font-semibold tabular-nums text-slate-900">
                    {g.start} – {g.end}
                  </h2>
                  <span className="text-xs text-slate-500">
                    {g.capacity ? `${g.used}/${g.capacity} ${g.capacity > 1 ? 'cupos' : 'cupo'}${siteId ? '' : ' por sede'}` : data.blocked ? 'Día sin visitas' : 'Horario que ya no está en la configuración'}
                  </span>
                </header>
                {g.bookings.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-400">Libre</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {g.bookings.map((b) => (
                      <BookingRow key={b.id} booking={b} showSite={!siteId} onConfirm={() => confirm(b)} onReject={() => setToReject(b)} />
                    ))}
                  </ul>
                )}
              </section>
            ))
          )}
        </div>
      )}

      <RejectDialog
        booking={toReject}
        onClose={() => setToReject(null)}
        onDone={() => {
          setToReject(null);
          load();
        }}
      />
      {creating && (
        <StaffVisitDialog
          defaultSiteId={siteId}
          onClose={() => setCreating(false)}
          onSaved={(b) => {
            setCreating(false);
            setDate(b.visit_date);
            load();
          }}
        />
      )}
    </div>
  );
}

/** Bloques configurados (aunque estén vacíos) + horarios antiguos que todavía tengan reservas. */
function groupBySlot({ blocks, bookings, blocked }) {
  const map = new Map(blocked ? [] : blocks.map((b) => [b.start, { ...b, bookings: [] }]));
  for (const b of bookings) {
    if (!map.has(b.start)) map.set(b.start, { start: b.start, end: b.end, capacity: null, bookings: [] });
    map.get(b.start).bookings.push(b);
  }
  return [...map.values()]
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((g) => ({ ...g, used: g.bookings.filter((b) => ACTIVE.includes(b.status)).length }));
}

function Verification({ booking: b }) {
  if (b.verification === 'GUARDIAN') {
    return (
      <Badge variant="success">
        <ShieldCheck className="size-3" /> Apoderado registrado{b.guardian_relationship ? ` · ${b.guardian_relationship}` : ''}
      </Badge>
    );
  }
  if (b.verification === 'MATCHED') {
    return (
      <Badge variant="warning">
        <ShieldQuestion className="size-3" /> No es apoderado registrado{b.relationship ? ` · ${b.relationship}` : ''}
      </Badge>
    );
  }
  return (
    <Badge variant="danger">
      <ShieldAlert className="size-3" /> Residente no identificado
    </Badge>
  );
}

const residentName = (b) => (b.resident_id ? `${b.resident_first_name} ${b.resident_last_name}` : null);

function BookingRow({ booking: b, showSite, onConfirm, onReject }) {
  const status = BOOKING_STATUS[b.status];
  const inactive = !ACTIVE.includes(b.status);
  return (
    <li className={cn('flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between', inactive && 'bg-slate-50/60 opacity-70')}>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-900">{b.visitor_name}</span>
          <Badge variant={status.variant}>{status.label}</Badge>
          {b.source === 'STAFF' && <Badge variant="muted">Agendada por el equipo</Badge>}
          <span className="font-mono text-xs text-slate-400">{b.code}</span>
        </div>
        <p className="text-sm text-slate-600">
          Visita a{' '}
          {b.resident_id ? (
            <Link to={`/residentes/${b.resident_id}`} className="font-medium text-slate-900 hover:text-brand-700">
              {residentName(b)}
            </Link>
          ) : (
            <span className="font-medium text-red-700">“{b.resident_name_input}”</span>
          )}
          {b.resident_id && b.resident_room && b.resident_room !== ROOM_PENDING && <span className="text-slate-400"> · {roomLabel({ room: b.resident_room, bed: b.resident_bed })}</span>}
          {showSite && <span className="text-slate-400"> · {b.site_name}</span>}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <Verification booking={b} />
          {b.resident_id && b.resident_name_input && b.verification !== 'GUARDIAN' && <span>Escribió: “{b.resident_name_input}”</span>}
          {b.phone && (
            <a href={phoneHref(b.phone)} className="flex items-center gap-1 text-brand-700 hover:underline">
              <Phone className="size-3" /> {formatPhone(b.phone)}
            </a>
          )}
          {b.doc_number && <span>{b.doc_type === 'RUT' ? `RUT ${formatRut(b.doc_number)}` : `Doc. ${b.doc_number}`}</span>}
          {b.status === 'REJECTED' && b.reject_reason && <span>Motivo: {b.reject_reason}</span>}
          {b.reviewed_by_name && <span>Revisó: {b.reviewed_by_name}</span>}
          {b.created_by_name && <span>Agendó: {b.created_by_name}</span>}
        </div>
      </div>
      {!inactive && (
        <div className="flex shrink-0 gap-2">
          {b.status === 'BOOKED' && (
            <Button size="sm" onClick={onConfirm}>
              <Check className="size-4" /> Confirmar
            </Button>
          )}
          <Button size="sm" variant="outline" className="text-red-700 hover:bg-red-50" onClick={onReject}>
            <X className="size-4" /> Rechazar
          </Button>
        </div>
      )}
    </li>
  );
}

/** Rechazar: primero hay que llamar al familiar para avisarle. */
function RejectDialog({ booking: b, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setReason('');
    setError('');
  }, [b]);

  async function reject() {
    setBusy(true);
    setError('');
    try {
      await bookingsApi.reject(b.id, reason.trim() || null);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={Boolean(b)}
      onClose={busy ? undefined : onClose}
      title="Rechazar reserva"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Volver
          </Button>
          <Button variant="destructive" onClick={reject} loading={busy}>
            Ya llamé, rechazar
          </Button>
        </>
      }
    >
      {b && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <Phone className="mt-0.5 size-5 shrink-0" />
            <p>
              <strong>Debes llamar al familiar</strong> para avisarle que su visita se cancela. El sistema todavía no envía avisos automáticos.
            </p>
          </div>
          <dl className="space-y-1.5 rounded-xl bg-slate-50 p-3 text-sm">
            <DataRow label="Quién visita">{b.visitor_name}</DataRow>
            <DataRow label="Teléfono">
              {b.phone ? (
                <a href={phoneHref(b.phone)} className="font-semibold text-brand-700 hover:underline">
                  {formatPhone(b.phone)}
                </a>
              ) : (
                'Sin teléfono'
              )}
            </DataRow>
            {b.doc_number && <DataRow label={b.doc_type === 'RUT' ? 'RUT' : 'Documento'}>{b.doc_type === 'RUT' ? formatRut(b.doc_number) : b.doc_number}</DataRow>}
            <DataRow label="Residente">{residentName(b) ?? `“${b.resident_name_input}” (no identificado)`}</DataRow>
            <DataRow label="Sede">{b.site_name}</DataRow>
            <DataRow label="Día">
              {dayTitle(b.visit_date)}
            </DataRow>
            <DataRow label="Horario">
              {b.start} – {b.end}
            </DataRow>
            <DataRow label="Código">
              <span className="font-mono">{b.code}</span>
            </DataRow>
          </dl>
          {b.phone && (
            <a
              href={phoneHref(b.phone)}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-brand-300 bg-brand-50 text-sm font-semibold text-brand-800 hover:bg-brand-100"
            >
              <Phone className="size-4" /> Llamar a {b.visitor_name.split(' ')[0]}
            </a>
          )}
          <Field label="Motivo (opcional)" htmlFor="reject_reason">
            <Input id="reject_reason" maxLength={200} placeholder="Ej: no es familiar del residente" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Alert>{error}</Alert>
        </div>
      )}
    </Dialog>
  );
}

function DataRow({ label, children }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{children}</dd>
    </div>
  );
}
