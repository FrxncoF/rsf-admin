import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BedDouble, Cake, IdCard, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Alert, EmptyState, Spinner } from '@/components/ui/Feedback';
import { useAuth } from '@/features/auth/AuthContext';
import { formatRut } from '@/lib/rut';
import { ageFrom, formatDate, roomLabel } from '@/lib/utils';
import { residentsApi } from '../residentsApi';
import { ResidentAvatar } from '../ResidentAvatar';
import ResidentFormDialog from '../admin/ResidentFormDialog';
import MedicalRecordPlaceholder from './MedicalRecordPlaceholder';
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
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                  <Info icon={BedDouble} label="Ubicación" value={roomLabel(resident)} />
                  <Info
                    icon={Cake}
                    label="Edad"
                    value={`${ageFrom(resident.birth_date)} años · ${formatDate(resident.birth_date)}`}
                  />
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

          <GuardiansCard guardians={resident.guardians} />

          <MedicalRecordPlaceholder resident={resident} />

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
