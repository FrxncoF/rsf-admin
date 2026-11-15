import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Form';
import { Alert } from '@/components/ui/Feedback';
import { longDay, publicBookingsApi } from '../bookingsApi';
import { DocInput, docIsValid } from './DocInput';
import { PublicShell } from './PublicShell';

/** Cancelar una reserva con el código + el documento con que se reservó: /reservar/cancelar */
export default function CancelBookingPage() {
  const [code, setCode] = useState('');
  const [doc, setDoc] = useState({ docType: 'RUT', docNumber: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!/^[A-Z0-9]{6}$/.test(code)) errs.code = 'El código tiene 6 caracteres';
    if (!docIsValid(doc.docType, doc.docNumber)) errs.doc_number = doc.docType === 'RUT' ? 'RUT inválido' : 'Ingresa tu documento';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setError('');
    try {
      setDone(await publicBookingsApi.cancel({ code, doc_type: doc.docType, doc_number: doc.docNumber }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <PublicShell title="Reserva cancelada">
        <div className="space-y-3 text-center">
          <CheckCircle2 className="mx-auto size-12 text-accent-600" />
          <p className="text-slate-700">
            Cancelamos tu visita del {longDay(done.date)} a las {done.start}. El horario queda libre para otra familia.
          </p>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell title="Cancelar una reserva">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <p className="text-sm text-slate-600">Ingresa el código que te dimos al reservar y el mismo documento que usaste.</p>
        <Alert>{error}</Alert>
        <Field label="Código de reserva" htmlFor="code" error={errors.code}>
          <Input
            id="code"
            className="h-12 font-mono text-lg uppercase tracking-[0.3em]"
            autoComplete="off"
            placeholder="ABC234"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          />
        </Field>
        <DocInput docType={doc.docType} docNumber={doc.docNumber} error={errors.doc_number} onChange={setDoc} />
        <Button type="submit" size="lg" variant="destructive" className="w-full" loading={busy}>
          Cancelar reserva
        </Button>
      </form>
    </PublicShell>
  );
}
