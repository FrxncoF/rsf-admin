import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert, Spinner } from '@/components/ui/Feedback';
import { roomLabel } from '@/lib/utils';
import { medicationsApi } from './medicationsApi';
import { PillboxTable } from './PillboxTable';

/**
 * Hoja del pastillero para imprimir (se abre en una pestaña nueva, sin menú).
 * Abre sola el diálogo de impresión, donde también se puede elegir "Guardar como PDF".
 */
export default function PillboxPrintPage() {
  const [params] = useSearchParams();
  const siteId = Number(params.get('sede')) || undefined;
  const [state, setState] = useState({ data: null, error: '' });

  useEffect(() => {
    document.title = 'Pastillero · Residencia San Francisco';
    medicationsApi
      .schedule({ site_id: siteId })
      .then((data) => setState({ data, error: '' }))
      .catch((err) => setState({ data: null, error: err.message }));
  }, [siteId]);

  // Se imprime cuando ya están los datos y el logo (si no, el logo saldría en blanco)
  const [logoReady, setLogoReady] = useState(false);
  useEffect(() => {
    if (!state.data || !logoReady) return undefined;
    const id = setTimeout(() => window.print(), 300);
    return () => clearTimeout(id);
  }, [state.data, logoReady]);

  if (state.error) return <Alert className="m-6">{state.error}</Alert>;
  if (!state.data) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const { today } = state.data;
  // En papel solo van los residentes que tienen medicamentos
  const residents = state.data.residents.filter((r) => r.medications.length > 0);
  const siteName = siteId ? state.data.residents[0]?.site_name : 'Todas las sedes';
  const printedOn = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${today}T12:00:00`));

  return (
    <div className="min-h-dvh bg-white text-slate-900">
      {/* Barra solo en pantalla */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur print:hidden">
        <p className="text-sm text-slate-600">Vista de impresión · elige tu impresora o “Guardar como PDF”</p>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="size-4" /> Imprimir / PDF
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.close()}>
            <X className="size-4" /> Cerrar
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-[210mm] px-4 py-4 print:max-w-none print:p-0">
        <header className="mb-3 flex items-end justify-between gap-4 border-b-2 border-brand-700 pb-2">
          <div className="flex items-end gap-4">
            <img
              src="/icons/logo.png"
              alt="Residencia San Francisco"
              className="h-14 w-auto"
              onLoad={() => setLogoReady(true)}
              onError={() => setLogoReady(true)}
            />
            <div className="border-l border-slate-300 pl-4">
              <h1 className="text-lg font-bold text-brand-800">Pastillero semanal</h1>
              <p className="text-xs text-slate-600">{siteName ? `${siteId ? 'Sede ' : ''}${siteName}` : ''}</p>
            </div>
          </div>
          <div className="text-right text-xs text-slate-600">
            <p>Impreso el {printedOn}</p>
            <p>Semana del ____ al ____</p>
          </div>
        </header>

        <div className="space-y-2.5">
          {residents.map((r) => (
            <section key={r.id} className="break-inside-avoid overflow-hidden rounded border border-slate-300">
              <h2 className="flex items-baseline justify-between bg-slate-100 px-2 py-1 text-xs">
                <span className="font-bold">
                  {r.first_name} {r.last_name}
                </span>
                <span className="text-slate-600">
                  {roomLabel(r)}
                  {!siteId && ` · ${r.site_name}`}
                </span>
              </h2>
              <PillboxTable medications={r.medications} printable />
            </section>
          ))}
        </div>

        <footer className="mt-4 flex justify-between text-[10px] text-slate-500">
          <span>AM = 00:00–11:59 · PM = 12:00–23:59 · SOS = solo si se necesita</span>
          <span>Preparó: ______________________</span>
        </footer>
      </div>
    </div>
  );
}
