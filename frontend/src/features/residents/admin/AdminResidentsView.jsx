import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Eye, Pencil, Plus, Power, Search, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Form';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Alert, EmptyState, Spinner } from '@/components/ui/Feedback';
import { useDebouncedValue } from '@/lib/hooks';
import { formatRut } from '@/lib/rut';
import { formatPhone } from '@/lib/phone';
import { ageFrom, formatDate } from '@/lib/utils';
import { useSites } from '@/features/sites/SiteContext';
import { dependencyOf } from '../constants';
import { residentsApi } from '../residentsApi';
import { useResidents } from '../useResidents';
import { ResidentAvatar } from '../ResidentAvatar';
import ResidentFormDialog from './ResidentFormDialog';

const PAGE_SIZE = 20;

export default function AdminResidentsView() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);
  const { siteId, currentSite } = useSites();

  useEffect(() => setPage(1), [debouncedSearch, status, sort, siteId]);

  const { data, meta, loading, error, reload } = useResidents({
    search: debouncedSearch,
    site_id: siteId,
    status,
    sort,
    page,
    pageSize: PAGE_SIZE,
  });

  const [formState, setFormState] = useState({ open: false, resident: null });
  const [confirm, setConfirm] = useState(null); // { type: 'delete' | 'status', resident }
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  const openCreate = () => setFormState({ open: true, resident: null });
  const openEdit = (resident) => setFormState({ open: true, resident });
  const closeForm = () => setFormState((s) => ({ ...s, open: false }));

  async function runConfirm() {
    const { type, resident } = confirm;
    setActionLoading(true);
    setActionError('');
    try {
      if (type === 'delete') await residentsApi.remove(resident.id);
      else await residentsApi.setStatus(resident.id, !resident.is_active);
      setConfirm(null);
      reload();
    } catch (err) {
      setActionError(err.message);
      setConfirm(null);
    } finally {
      setActionLoading(false);
    }
  }

  const actions = (resident) => (
    <div className="flex items-center justify-end gap-1">
      <Link
        to={`/residentes/${resident.id}`}
        title="Ver ficha"
        aria-label="Ver ficha"
        className="inline-flex size-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      >
        <Eye className="size-4" />
      </Link>
      <Button variant="ghost" size="icon" title="Editar" aria-label="Editar" onClick={() => openEdit(resident)}>
        <Pencil className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title={resident.is_active ? 'Desactivar' : 'Activar'}
        aria-label={resident.is_active ? 'Desactivar' : 'Activar'}
        onClick={() => setConfirm({ type: 'status', resident })}
      >
        <Power className={resident.is_active ? 'size-4 text-accent-600' : 'size-4 text-slate-400'} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title="Eliminar"
        aria-label="Eliminar"
        className="hover:bg-red-50 hover:text-red-600"
        onClick={() => setConfirm({ type: 'delete', resident })}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Residentes</h1>
          <p className="mt-1 text-sm text-slate-500">
            {meta ? `${meta.total} residente${meta.total === 1 ? '' : 's'}` : 'Gestión de residentes'}
            {currentSite ? ` · Sede ${currentSite.name}` : ' · Todas las sedes'}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" /> Nuevo residente
        </Button>
      </div>

      {/* Filtros */}
      <Card className="flex flex-col gap-3 p-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="Buscar por nombre, RUT o habitación"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 md:flex">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estado" className="md:w-36">
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
            <option value="all">Todos</option>
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenar" className="md:w-44">
            <option value="name">Ordenar: Apellido</option>
            <option value="room">Ordenar: Habitación</option>
            <option value="created">Ordenar: Más recientes</option>
          </Select>
        </div>
      </Card>

      <Alert>{error || actionError}</Alert>

      <Card className="overflow-hidden">
        {loading && data.length === 0 ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : data.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No hay residentes"
            description={search ? 'Prueba con otra búsqueda.' : 'Agrega el primer residente para comenzar.'}
            action={!search && <Button onClick={openCreate}><Plus className="size-4" /> Nuevo residente</Button>}
          />
        ) : (
          <>
            {/* Tabla: escritorio */}
            <div className={loading ? 'opacity-60 transition-opacity' : undefined}>
              <table className="hidden w-full text-left text-sm md:table">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Residente</th>
                    <th className="px-4 py-3 font-medium">RUT</th>
                    <th className="px-4 py-3 font-medium">Nacimiento</th>
                    <th className="px-4 py-3 font-medium">Ubicación</th>
                    <th className="px-4 py-3 font-medium">Dependencia</th>
                    <th className="px-4 py-3 font-medium">Apoderado</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <Link to={`/residentes/${r.id}`} className="flex items-center gap-3">
                          <ResidentAvatar resident={r} size="sm" />
                          <span className="font-medium text-slate-900 hover:text-brand-700">
                            {r.last_name}, {r.first_name}
                          </span>
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-600">{formatRut(r.rut)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(r.birth_date)} <span className="text-slate-400">({ageFrom(r.birth_date)} años)</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <span className="block whitespace-nowrap">
                          Hab. {r.room}
                          {r.bed && <span className="text-slate-400"> / {r.bed}</span>}
                        </span>
                        <span className="text-xs text-slate-400">{r.site_name}</span>
                      </td>
                      <td className="px-4 py-3">
                        {dependencyOf(r.dependency_level) ? (
                          <Badge variant={dependencyOf(r.dependency_level).badge}>
                            {dependencyOf(r.dependency_level).short}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.guardians?.[0] ? (
                          <div className="leading-tight">
                            <p className="text-slate-900">
                              {r.guardians[0].full_name}
                              {r.guardians.length > 1 && <span className="text-xs text-slate-400"> +1</span>}
                            </p>
                            <p className="text-xs text-slate-500">
                              {r.guardians[0].relationship} · {formatPhone(r.guardians[0].phone)}
                            </p>
                          </div>
                        ) : (
                          <Badge variant="warning">Sin apoderado</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={r.is_active ? 'success' : 'muted'}>{r.is_active ? 'Activo' : 'Inactivo'}</Badge>
                      </td>
                      <td className="px-4 py-2">{actions(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Lista: móvil */}
              <ul className="divide-y divide-slate-100 md:hidden">
                {data.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                    <ResidentAvatar resident={r} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">
                        {r.first_name} {r.last_name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {r.site_name} · Hab. {r.room}
                        {r.bed && ` · Cama ${r.bed}`}
                      </p>
                      {(!r.is_active || !r.guardians?.length) && (
                        <div className="mt-1 flex gap-1">
                          {!r.is_active && <Badge variant="muted">Inactivo</Badge>}
                          {!r.guardians?.length && <Badge variant="warning">Sin apoderado</Badge>}
                        </div>
                      )}
                    </div>
                    {actions(r)}
                  </li>
                ))}
              </ul>
            </div>

            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
                <span>
                  Página {meta.page} de {meta.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="size-4" /> Anterior
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                    Siguiente <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <ResidentFormDialog
        open={formState.open}
        resident={formState.resident}
        onClose={closeForm}
        onSaved={(_resident, { photoError } = {}) => {
          closeForm();
          setActionError(photoError ? `Datos guardados, pero la foto no se pudo actualizar: ${photoError}` : '');
          reload();
        }}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirm}
        loading={actionLoading}
        destructive={confirm?.type === 'delete' || confirm?.resident.is_active}
        title={
          confirm?.type === 'delete'
            ? 'Eliminar residente'
            : confirm?.resident.is_active
              ? 'Desactivar residente'
              : 'Activar residente'
        }
        confirmLabel={confirm?.type === 'delete' ? 'Eliminar definitivamente' : confirm?.resident.is_active ? 'Desactivar' : 'Activar'}
        description={
          confirm &&
          (confirm.type === 'delete'
            ? `Se eliminará a ${confirm.resident.first_name} ${confirm.resident.last_name} de forma permanente. Si solo dejó la residencia, es preferible desactivarlo.`
            : confirm.resident.is_active
              ? `${confirm.resident.first_name} ${confirm.resident.last_name} dejará de aparecer para las cuidadoras y su cama quedará libre.`
              : `${confirm.resident.first_name} ${confirm.resident.last_name} volverá a aparecer para las cuidadoras.`)
        }
      />
    </div>
  );
}
