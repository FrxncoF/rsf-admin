import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BedDouble,
  Building2,
  Cake,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Coins,
  IdCard,
  Pencil,
} from 'lucide-react';
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
import DailyLogsCard from '@/features/daily-log/DailyLogsCard';
import ClinicalCard from './ClinicalCard';
import GuardiansCard from './GuardiansCard';

export default function ResidentDetailPage() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const [resident, setResident] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [savedLog, setSavedLog] = useState(Boolean(location.state?.savedLog));

  // Aviso "ficha guardada" al volver del formulario (se limpia el state para no repetirlo)
  useEffect(() => {
    if (!location.state?.savedLog) return;
    navigate(location.pathname, { replace: true, state: null });
    const t = setTimeout(() => setSavedLog(false), 4000);
    return () => clearTimeout(t);
  }, [location, navigate]);

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

  // Tras guardar una ficha, llevar la vista al historial (está al final de la página)
  const loaded = Boolean(resident);
  useEffect(() => {
    if (savedLog && loaded) document.getElementById('fichas-diarias')?.scrollIntoView({ behavior: 'smooth' });
  }, [savedLog, loaded]);

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
                {isAdmin && missingFields(resident).length > 0 && (
                  <div className="mt-4 flex flex-col gap-3 rounded-lg bg-amber-50 px-3 py-2.5 text-left ring-1 ring-amber-200 sm:flex-row sm:items-center">
                    <AlertTriangle className="hidden size-5 shrink-0 text-amber-600 sm:block" />
                    <p className="flex-1 text-sm text-amber-900">
                      <span className="font-semibold">Faltan datos:</span> {missingFields(resident).join(', ')}.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="bg-white">
                      <Pencil className="size-4" /> Completar
                    </Button>
                  </div>
                )}
              </div>
              {isAdmin && (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="size-4" /> Editar
                </Button>
              )}
            </div>
          </Card>

          {isAdmin && <PaymentCard resident={resident} />}

          <ClinicalCard resident={resident} canEdit={isAdmin} onChange={setResident} />

          <GuardiansCard guardians={resident.guardians} />

          {savedLog && (
            <p className="flex items-center gap-2 rounded-lg bg-accent-50 px-4 py-3 text-sm font-medium text-accent-800 ring-1 ring-accent-200">
              <CheckCircle2 className="size-4" /> Ficha guardada
            </p>
          )}

          <DailyLogsCard resident={resident} />

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

// Campos obligatorios del formulario que pueden faltar en residentes creados antes de agregarlos
const REQUIRED_FIELDS = [
  ['admission_date', 'fecha de ingreso'],
  ['monthly_fee_uf', 'mensualidad'],
  ['payment_due_day', 'día de pago'],
  ['health_system', 'previsión'],
  ['ambulance', 'ambulancia'],
  ['has_cesfam', 'CESFAM'],
  ['dependency_level', 'Katz'],
  ['cognitive_level', 'Pfeiffer'],
  ['pressure_risk', 'Norton'],
];
const missingFields = (resident) => REQUIRED_FIELDS.filter(([key]) => resident[key] == null).map(([, label]) => label);

/** Mensualidad en UF y su equivalente en pesos con la UF del día (solo ADMIN). */
function PaymentCard({ resident }) {
  const { uf } = useUf();
  const fee = resident.monthly_fee_uf;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="size-5 text-accent-600" /> Mensualidad
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-lg bg-accent-50 px-3 py-2.5">
            <dt className="text-xs text-accent-800">Monto mensual</dt>
            <dd className="text-lg font-semibold text-slate-900">{formatUf(fee)}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2.5">
            <dt className="text-xs text-slate-500">Equivalente hoy</dt>
            <dd className="text-lg font-semibold text-slate-900">{uf && fee != null ? formatClp(fee * uf.value) : '—'}</dd>
            {uf && <dd className="text-xs text-slate-500">UF {formatUfValue(uf.value)} · {formatDate(uf.date)}</dd>}
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-brand-600" />
            <div>
              <dt className="text-xs text-slate-500">Día de pago</dt>
              <dd className="font-medium text-slate-900">
                {resident.payment_due_day ? `Día ${resident.payment_due_day} de cada mes` : '—'}
              </dd>
            </div>
          </div>
        </dl>
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
