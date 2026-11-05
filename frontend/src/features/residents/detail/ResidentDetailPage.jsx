import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Activity, ArrowLeft, BedDouble, Building2, Cake, CalendarCheck, CalendarClock, Coins, IdCard, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Alert, EmptyState, Spinner } from '@/components/ui/Feedback';
import { useAuth } from '@/features/auth/AuthContext';
import { formatRut } from '@/lib/rut';
import { ageFrom, formatDate, roomLabel } from '@/lib/utils';
import { formatClp, formatUf, formatUfValue, useUf } from '@/lib/money';
import { dependencyOf } from '../constants';
import { residentsApi } from '../residentsApi';
import { ResidentAvatar } from '../ResidentAvatar';
import ResidentFormDialog from '../admin/ResidentFormDialog';
import DailyLogSheet from '@/features/daily-log/DailyLogSheet';
import GuardiansCard from './GuardiansCard';

export default function ResidentDetailPage() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const [resident, setResident] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    residentsApi
      .get(id)
      .then((data) => {
        setResident(data);
        setError('');
      })
      .catch((err) => setError(err.status === 404 ? 'not-found' : err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  if (loading && !resident) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error === 'not-found') {
    return (
      <EmptyState
        title="Residente no encontrado"
        description="Puede que haya sido dado de baja."
        action={<BackLink />}
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <BackLink />
      <Alert>{error}</Alert>

      {resident && (
        <>
          <Card className="p-5 sm:p-6">
            <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:text-left">
              <ResidentAvatar resident={resident} size="lg" className="size-28 text-3xl ring-4 ring-white shadow-md" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <h1 className="text-2xl font-semibold text-slate-900">
                    {resident.first_name} {resident.last_name}
                  </h1>
                  {!resident.is_active && <Badge variant="muted">Inactivo</Badge>}
                </div>
                {dependencyOf(resident.dependency_level) && (
                  <Badge variant={dependencyOf(resident.dependency_level).badge} className="mt-2 text-sm">
                    <Activity className="size-3.5" /> {dependencyOf(resident.dependency_level).label}
                  </Badge>
                )}
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                  <Info icon={Building2} label="Sede" value={resident.site_name} />
                  <Info icon={BedDouble} label="Habitación" value={roomLabel(resident)} />
                  <Info
                    icon={Cake}
                    label="Edad"
                    value={`${ageFrom(resident.birth_date)} años · ${formatDate(resident.birth_date)}`}
                  />
                  <Info icon={CalendarCheck} label="Fecha de ingreso" value={formatDate(resident.admission_date)} />
                  {isAdmin && <Info icon={IdCard} label="RUT" value={formatRut(resident.rut)} />}
                </dl>
              </div>
              {isAdmin && (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="size-4" /> Editar
                </Button>
              )}
            </div>
          </Card>

          {isAdmin && <PaymentCard resident={resident} onEdit={() => setEditing(true)} />}

          <DailyLogSheet resident={resident} />

          <GuardiansCard guardians={resident.guardians} />

          {isAdmin && (
            <ResidentFormDialog
              open={editing}
              resident={resident}
              onClose={() => setEditing(false)}
              onSaved={(saved, { photoError } = {}) => {
                setEditing(false);
                setResident(saved);
                if (photoError) setError(`Datos guardados, pero la foto no se pudo actualizar: ${photoError}`);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/residentes"
      className="inline-flex h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    >
      <ArrowLeft className="size-4" /> Volver a residentes
    </Link>
  );
}

/** Mensualidad en UF y su equivalente en pesos con la UF del día (solo ADMIN). */
function PaymentCard({ resident, onEdit }) {
  const { uf } = useUf();
  const fee = resident.monthly_fee_uf;
  const missing = fee == null || resident.payment_due_day == null || !resident.admission_date || !resident.dependency_level;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Coins className="size-5 text-accent-600" /> Mensualidad
        </CardTitle>
        {missing && <Badge variant="warning">Faltan datos</Badge>}
      </CardHeader>
      <CardContent>
        {missing ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              Faltan la fecha de ingreso, el nivel de dependencia o los datos de pago de este residente.
            </p>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="size-4" /> Completar
            </Button>
          </div>
        ) : (
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-lg bg-accent-50 px-3 py-2.5">
              <dt className="text-xs text-accent-800">Monto mensual</dt>
              <dd className="text-lg font-semibold text-slate-900">{formatUf(fee)}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2.5">
              <dt className="text-xs text-slate-500">Equivalente hoy</dt>
              <dd className="text-lg font-semibold text-slate-900">{uf ? formatClp(fee * uf.value) : '—'}</dd>
              {uf && <dd className="text-xs text-slate-500">UF {formatUfValue(uf.value)} · {formatDate(uf.date)}</dd>}
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5">
              <CalendarClock className="mt-0.5 size-4 shrink-0 text-brand-600" />
              <div>
                <dt className="text-xs text-slate-500">Día de pago</dt>
                <dd className="font-medium text-slate-900">Día {resident.payment_due_day} de cada mes</dd>
              </div>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start justify-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 sm:justify-start">
      <Icon className="mt-0.5 size-4 shrink-0 text-brand-600" />
      <div className="text-left">
        <dt className="text-xs text-slate-500">{label}</dt>
        <dd className="font-medium text-slate-900">{value}</dd>
      </div>
    </div>
  );
}
