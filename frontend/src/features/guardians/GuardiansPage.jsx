import { useCallback, useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Contact, Mail, MapPin, Pencil, Phone, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Form';
import { Alert, EmptyState, Spinner } from '@/components/ui/Feedback';
import { useDebouncedValue } from '@/lib/hooks';
import { formatPhone, phoneHref } from '@/lib/phone';
import { formatRut } from '@/lib/rut';
import { guardiansApi } from './guardiansApi';
import { EMPTY_GUARDIAN, GuardianFields, toGuardianForm, toGuardianPayload, validateGuardian } from './GuardianFields';

/** Módulo Apoderados (ADMIN): un apoderado puede estar a cargo de varios residentes. */
export default function GuardiansPage() {
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search);
  const [state, setState] = useState({ data: [], meta: null, loading: true, error: '' });
  const [dialog, setDialog] = useState({ open: false, guardian: null });
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    guardiansApi
      .list({ search: debounced.trim() || undefined, pageSize: 100 })
      .then(({ data, meta }) => setState({ data, meta, loading: false, error: '' }))
      .catch((err) => setState((s) => ({ ...s, loading: false, error: err.message })));
  }, [debounced]);

  useEffect(load, [load]);

  async function confirmDelete() {
    setDeleting(true);
    setActionError('');
    try {
      await guardiansApi.remove(toDelete.id);
      setToDelete(null);
      load();
    } catch (err) {
      setActionError(err.message);
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  const { data, meta, loading, error } = state;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Apoderados</h1>
          <p className="mt-1 text-sm text-slate-500">
            {meta ? `${meta.total} apoderado${meta.total === 1 ? '' : 's'}` : 'Contactos responsables de los residentes'}
          </p>
        </div>
        <Button onClick={() => setDialog({ open: true, guardian: null })}>
          <Plus className="size-4" /> Nuevo apoderado
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          type="search"
          placeholder="Buscar por nombre, RUT o teléfono"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Alert>{error || actionError}</Alert>

      {loading && data.length === 0 ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : data.length === 0 ? (
        <Card>
          <EmptyState
            icon={search ? Search : Contact}
            title={search ? 'Sin resultados' : 'Aún no hay apoderados'}
            description={search ? 'Prueba con otra búsqueda.' : 'Se crean aquí o al registrar un residente.'}
          />
        </Card>
      ) : (
        <ul className={`grid gap-3 md:grid-cols-2 ${loading ? 'opacity-60 transition-opacity' : ''}`}>
          {data.map((g) => (
            <li key={g.id}>
              <GuardianCard
                guardian={g}
                onEdit={() => setDialog({ open: true, guardian: g })}
                onDelete={() => setToDelete(g)}
              />
            </li>
          ))}
        </ul>
      )}

      <GuardianFormDialog
        open={dialog.open}
        guardian={dialog.guardian}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
        onSaved={() => {
          setDialog((d) => ({ ...d, open: false }));
          load();
        }}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        destructive
        title="Eliminar apoderado"
        confirmLabel="Eliminar"
        description={toDelete && `Se eliminará a ${toDelete.full_name} de forma permanente.`}
      />
    </div>
  );
}

function GuardianCard({ guardian: g, onEdit, onDelete }) {
  const linked = g.residents.length > 0;
  return (
    <Card className="flex h-full flex-col p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">{g.full_name}</p>
          {g.rut && <p className="text-xs text-slate-500">RUT {formatRut(g.rut)}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="icon" title="Editar" aria-label="Editar" onClick={onEdit}>
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title={linked ? 'Tiene residentes asociados' : 'Eliminar'}
            aria-label="Eliminar"
            disabled={linked}
            className="hover:bg-red-50 hover:text-red-600"
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mt-2 space-y-1 text-sm text-slate-600">
        <a href={phoneHref(g.phone)} className="flex items-center gap-2 font-medium text-brand-700 hover:underline">
          <Phone className="size-4 shrink-0" /> {formatPhone(g.phone)}
        </a>
        {g.email && (
          <a href={`mailto:${g.email}`} className="flex items-center gap-2 hover:text-brand-700">
            <Mail className="size-4 shrink-0" /> <span className="truncate">{g.email}</span>
          </a>
        )}
        {g.address && (
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0" /> {g.address}
          </p>
        )}
      </div>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Residentes a cargo ({g.residents.length})
        </p>
        {linked ? (
          <ul className="flex flex-wrap gap-2">
            {g.residents.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/residentes/${r.id}`}
                  className="flex items-center gap-1.5 rounded-lg bg-accent-50 px-2.5 py-1.5 text-sm text-accent-900 ring-1 ring-accent-200 hover:bg-accent-100"
                >
                  <span className="font-medium">
                    {r.first_name.split(' ')[0]} {r.last_name.split(' ')[0]}
                  </span>
                  <span className="text-xs text-accent-700">
                    {r.relationship} · {r.site_name}
                  </span>
                  {!r.is_active && <Badge variant="muted">Inactivo</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">Sin residentes asociados</p>
        )}
      </div>
    </Card>
  );
}

function GuardianFormDialog({ open, guardian, onClose, onSaved }) {
  const isEdit = Boolean(guardian);
  const formId = useId();
  const [values, setValues] = useState(EMPTY_GUARDIAN);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(guardian ? toGuardianForm(guardian) : EMPTY_GUARDIAN);
    setErrors({});
    setServerError('');
  }, [open, guardian]);

  async function handleSubmit(e) {
    e.preventDefault();
    const clientErrors = validateGuardian(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    setSaving(true);
    setServerError('');
    try {
      const payload = toGuardianPayload(values);
      if (isEdit) await guardiansApi.update(guardian.id, payload);
      else await guardiansApi.create(payload);
      onSaved();
    } catch (err) {
      setServerError(err.message);
      if (err.details) setErrors(err.details);
    } finally {
      setSaving(false);
    }
  }

  const shared = isEdit && guardian.residents.length > 1;

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      title={isEdit ? 'Editar apoderado' : 'Nuevo apoderado'}
      description={shared ? `Los cambios se verán en los ${guardian.residents.length} residentes que tiene a cargo.` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} loading={saving}>
            Guardar
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4">
        <Alert>{serverError}</Alert>
        <GuardianFields
          idPrefix={formId}
          values={values}
          errors={errors}
          onChange={(key, value) => {
            setValues((v) => ({ ...v, [key]: value }));
            setErrors((errs) => ({ ...errs, [key]: undefined }));
          }}
        />
        {!isEdit && (
          <p className="text-xs text-slate-500">El parentesco se indica al asignarlo a cada residente.</p>
        )}
      </form>
    </Dialog>
  );
}
