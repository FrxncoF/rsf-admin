import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Pill, Printer, Search, Share } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Form';
import { Alert, EmptyState, Spinner } from '@/components/ui/Feedback';
import { useSites } from '@/features/sites/SiteContext';
import { ResidentAvatar } from '@/features/residents/ResidentAvatar';
import { roomLabel } from '@/lib/utils';
import { medicationsApi } from './medicationsApi';
import { PillboxTable } from './PillboxTable';
import { buildPillboxPdf, preferPdfShare, sharePdf } from './pillboxPdf';

const norm = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Pastillero semanal: medicamentos de cada residente separados en mañana (AM) y tarde/noche (PM). */
export default function PillboxPage() {
  const { siteId, currentSite } = useSites();
  const [state, setState] = useState({ residents: [], today: null, loading: true, error: '' });
  const [search, setSearch] = useState('');

  useEffect(() => {
    setState((s) => ({ ...s, loading: true }));
    medicationsApi
      .schedule({ site_id: siteId ?? undefined })
      .then((data) => setState({ residents: data.residents, today: data.today, loading: false, error: '' }))
      .catch((err) => setState((s) => ({ ...s, loading: false, error: err.message })));
  }, [siteId]);

  // Celular / app instalada: PDF real + menú nativo de compartir (Imprimir, Archivos, WhatsApp…).
  // iOS no permite window.print() en la app instalada. En el computador: vista de impresión en otra pestaña.
  const usePdf = useRef(preferPdfShare()).current;
  const [pdf, setPdf] = useState({ file: null, building: false, error: '', note: '' });
  const siteName = currentSite ? `Sede ${currentSite.name}` : 'Todas las sedes';

  // El PDF se prepara apenas llegan los datos: así el toque abre el menú al instante (iOS lo exige)
  useEffect(() => {
    if (!usePdf || state.loading || !state.today) return undefined;
    let alive = true;
    setPdf({ file: null, building: true, error: '', note: '' });
    buildPillboxPdf({ residents: state.residents, siteName, allSites: !siteId, today: state.today })
      .then((file) => alive && setPdf({ file, building: false, error: '', note: '' }))
      .catch((err) => alive && setPdf({ file: null, building: false, error: `No se pudo generar el PDF: ${err.message}`, note: '' }));
    return () => {
      alive = false;
    };
  }, [usePdf, state.loading, state.today, state.residents, siteName, siteId]);

  async function openPrint() {
    if (!usePdf) {
      window.open(`/pastillero/imprimir${siteId ? `?sede=${siteId}` : ''}`, '_blank');
      return;
    }
    if (!pdf.file) return;
    try {
      const result = await sharePdf(pdf.file);
      const notes = {
        retry: 'Toca el botón de nuevo para abrir el menú.',
        downloaded: 'El PDF se descargó: ábrelo para imprimirlo o compartirlo.',
      };
      setPdf((p) => ({ ...p, note: notes[result] ?? '' }));
    } catch (err) {
      setPdf((p) => ({ ...p, error: `No se pudo compartir: ${err.message}` }));
    }
  }

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
        <Button onClick={openPrint} disabled={state.loading || state.residents.length === 0 || (usePdf && !pdf.file)}>
          {usePdf ? (
            pdf.building ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Preparando PDF…
              </>
            ) : (
              <>
                <Share className="size-4" /> Imprimir / compartir PDF
              </>
            )
          ) : (
            <>
              <Printer className="size-4" /> Imprimir
            </>
          )}
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input className="pl-9" placeholder="Buscar residente o habitación" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Alert>{state.error || pdf.error}</Alert>
      {pdf.note && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{pdf.note}</p>}

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
