import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pill, Printer, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Form';
import { Alert, EmptyState, Spinner } from '@/components/ui/Feedback';
import { useSites } from '@/features/sites/SiteContext';
import { ResidentAvatar } from '@/features/residents/ResidentAvatar';
import { roomLabel } from '@/lib/utils';
import { medicationsApi } from './medicationsApi';
import { PillboxTable } from './PillboxTable';

const norm = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Pastillero semanal: medicamentos de cada residente separados en mañana (AM) y tarde/noche (PM). */
export default function PillboxPage() {
  const { siteId, currentSite } = useSites();
  const [state, setState] = useState({ residents: [], loading: true, error: '' });
  const [search, setSearch] = useState('');

  useEffect(() => {
    setState((s) => ({ ...s, loading: true }));
    medicationsApi
      .schedule({ site_id: siteId ?? undefined })
      .then((data) => setState({ residents: data.residents, loading: false, error: '' }))
      .catch((err) => setState((s) => ({ ...s, loading: false, error: err.message })));
  }, [siteId]);

  // Pestaña nueva con la hoja lista para imprimir o guardar como PDF
  const openPrint = () => window.open(`/pastillero/imprimir${siteId ? `?sede=${siteId}` : ''}`, '_blank');

  const q = norm(search.trim());
  const residents = state.residents.filter((r) => !q || norm(`${r.first_name} ${r.last_name} ${r.room}`).includes(q));
  const totalMeds = state.residents.reduce((n, r) => n + r.medications.length, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Pastillero</h1>
          <p className="mt-1 text-sm text-slate-500">
            {currentSite ? `Sede ${currentSite.name}` : 'Todas las sedes'} · {state.residents.length} residentes · {totalMeds} medicamentos
          </p>
        </div>
        <Button onClick={openPrint} disabled={state.loading || state.residents.length === 0}>
          <Printer className="size-4" /> Imprimir
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input className="pl-9" placeholder="Buscar residente o habitación" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Alert>{state.error}</Alert>

      {state.loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : residents.length === 0 ? (
        <Card>
          <EmptyState icon={Pill} title={search ? 'Sin resultados' : 'No hay residentes activos'} />
        </Card>
      ) : (
        <ul className="space-y-4">
          {residents.map((r) => (
            <li key={r.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-3 py-2">
                <ResidentAvatar resident={r} size="sm" />
                <div className="min-w-0">
                  <Link to={`/residentes/${r.id}`} className="block truncate font-semibold text-slate-900 hover:text-brand-700">
                    {r.first_name} {r.last_name}
                  </Link>
                  <p className="truncate text-xs text-slate-500">
                    {roomLabel(r)}
                    {!siteId && ` · ${r.site_name}`}
                  </p>
                </div>
              </div>
              <PillboxTable medications={r.medications} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
