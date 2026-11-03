import { ClipboardList } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

/**
 * PUNTO DE EXTENSIÓN · Fase 2
 * Aquí se montará el formulario de Ficha Médica (digitalizado desde el PDF físico).
 * Recibe el residente completo para que el formulario pueda precargar sus datos.
 * Reemplazar este componente por <MedicalRecordForm resident={resident} /> en ResidentDetailPage.
 */
export default function MedicalRecordPlaceholder({ resident }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Ficha médica</CardTitle>
        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
          Próximamente
        </span>
      </CardHeader>
      <CardContent>
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-6 py-14 text-center"
          data-slot="medical-record"
          data-resident-id={resident.id}
        >
          <div className="flex size-14 items-center justify-center rounded-full bg-accent-50 text-accent-700 shadow-sm ring-1 ring-accent-200">
            <ClipboardList className="size-7" />
          </div>
          <div>
            <p className="font-medium text-slate-900">La ficha médica estará disponible en la siguiente etapa</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              Este espacio está reservado para el formulario de ficha médica de {resident.first_name}.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
