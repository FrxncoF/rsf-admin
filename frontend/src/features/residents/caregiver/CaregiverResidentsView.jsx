import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Users } from 'lucide-react';
import { Input } from '@/components/ui/Form';
import { Alert, EmptyState, Spinner } from '@/components/ui/Feedback';
import { ageFrom, cn } from '@/lib/utils';
import { ResidentAvatar } from '../ResidentAvatar';
import { useResidents } from '../useResidents';
import { useSites } from '@/features/sites/SiteContext';

/**
 * Vista para cuidadoras (móvil): grilla de tarjetas grandes para SELECCIONAR al residente.
 * El filtro solo acota la grilla; nunca se escriben nombres para crear registros.
 */
export default function CaregiverResidentsView() {
  const { siteId, currentSite } = useSites();
  const { data, loading, error } = useResidents({ site_id: siteId, status: 'active', sort: 'room', pageSize: 200 });
  const [filter, setFilter] = useState('');
  const [room, setRoom] = useState(null);

  useEffect(() => setRoom(null), [siteId]);

  // Las habitaciones se repiten entre sedes: la clave incluye la sede
  const roomKey = (r) => `${r.site_id}:${r.room}`;
  const rooms = useMemo(() => {
    const map = new Map(data.map((r) => [roomKey(r), r]));
    return [...map.entries()]
      .sort(([, a], [, b]) => a.site_name.localeCompare(b.site_name) || a.room.localeCompare(b.room, 'es', { numeric: true }))
      .map(([key, r]) => ({ key, label: siteId ? `Hab. ${r.room}` : `Hab. ${r.room} · ${r.site_name}` }));
  }, [data, siteId]);

  const visible = useMemo(() => {
    const text = filter.trim().toLowerCase();
    return data.filter(
      (r) =>
        (!room || roomKey(r) === room) &&
        (!text || `${r.first_name} ${r.last_name} ${r.room} ${r.site_name}`.toLowerCase().includes(text)),
    );
  }, [data, filter, room]);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold text-slate-900">Residentes</h1>
      <p className="mt-1 text-sm text-slate-500">
        {currentSite ? `Sede ${currentSite.name}` : 'Todas las sedes'} · Toca a un residente para ver su ficha.
      </p>

      <div className="sticky top-14 z-20 -mx-4 mt-4 space-y-3 bg-slate-50/95 px-4 py-3 backdrop-blur lg:top-0">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="Filtrar por nombre o habitación"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-12 rounded-xl pl-11 text-base"
          />
        </div>
        {rooms.length > 1 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            <RoomChip active={!room} onClick={() => setRoom(null)}>
              Todas
            </RoomChip>
            {rooms.map((r) => (
              <RoomChip key={r.key} active={room === r.key} onClick={() => setRoom(room === r.key ? null : r.key)}>
                {r.label}
              </RoomChip>
            ))}
          </div>
        )}
      </div>

      <Alert className="mt-4">{error}</Alert>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-8" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState icon={Users} title="Sin resultados" description="No hay residentes que coincidan con el filtro." />
      ) : (
        <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((resident) => (
            <li key={resident.id}>
              <Link
                to={`/residentes/${resident.id}`}
                className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition active:scale-[0.98] hover:border-brand-300 hover:shadow-md"
              >
                <div className="aspect-square">
                  <ResidentAvatar resident={resident} fill />
                </div>
                <div className="p-3">
                  <p className="truncate text-base font-semibold leading-tight text-slate-900">{resident.first_name}</p>
                  <p className="truncate text-sm text-slate-600">{resident.last_name}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="rounded-md bg-brand-600 px-2 py-0.5 text-sm font-semibold text-white">
                      Hab. {resident.room}
                      {resident.bed && <span className="font-normal"> · {resident.bed}</span>}
                    </span>
                    <span className="text-xs text-slate-500">{ageFrom(resident.birth_date)} años</span>
                  </div>
                  {!siteId && <p className="mt-1.5 truncate text-xs font-medium text-accent-700">{resident.site_name}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RoomChip({ active, className, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        'h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition',
        active ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700',
        className,
      )}
      {...props}
    />
  );
}
