import { cn } from '@/lib/utils';
import { Mail, MapPin, Phone, UserRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatRut } from '@/lib/rut';
import { formatPhone, phoneHref } from '@/lib/phone';

/** Apoderados del residente. La cuidadora recibe solo nombre, parentesco y teléfono. */
export default function GuardiansCard({ guardians = [] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Apoderados</CardTitle>
      </CardHeader>
      <CardContent className={cn('grid gap-3', guardians.length > 1 && 'sm:grid-cols-2')}>
        {guardians.map((g) => (
          <div key={g.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-800">
                <UserRound className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{g.full_name}</p>
                <p className="text-sm text-slate-500">
                  {g.relationship}
                  {g.position === 1 && ' · Principal'}
                  {g.rut && ` · ${formatRut(g.rut)}`}
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-1.5 text-sm">
              {/* Botón grande para llamar directo desde el celular */}
              <a
                href={phoneHref(g.phone)}
                className="flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-3 font-medium text-white hover:bg-brand-700 active:bg-brand-800"
              >
                <Phone className="size-4" /> {formatPhone(g.phone)}
              </a>
              {g.email && (
                <a href={`mailto:${g.email}`} className="flex items-center gap-2 px-1 py-1 text-slate-600 hover:text-brand-700">
                  <Mail className="size-4 shrink-0" /> <span className="truncate">{g.email}</span>
                </a>
              )}
              {g.address && (
                <p className="flex items-start gap-2 px-1 py-1 text-slate-600">
                  <MapPin className="mt-0.5 size-4 shrink-0" /> {g.address}
                </p>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
