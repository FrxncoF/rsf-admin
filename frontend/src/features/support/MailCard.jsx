import { useEffect, useState } from 'react';
import { Mail, Send } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Alert, Spinner } from '@/components/ui/Feedback';
import { api } from '@/lib/api';

/** Estado del correo saliente (Zoho) y envío de prueba al correo de quien está conectado. */
export function MailCard() {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api
      .get('/support/mail')
      .then(({ data }) => setInfo(data))
      .catch((err) => setError(err.message));
  }, []);

  async function test() {
    setSending(true);
    setError('');
    setResult('');
    try {
      const { data } = await api.post('/support/mail/test');
      setResult(
        data.sent
          ? `Enviado a ${data.to}. Revisa la bandeja (y spam).`
          : 'Modo prueba: el correo se mostró en la consola del servidor (no se envió).',
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-5 text-brand-600" /> Correo saliente
        </CardTitle>
        <p className="text-sm text-slate-500">Se usa para "Olvidé mi contraseña". Las credenciales van solo en el archivo .env del servidor.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!info ? (
          error ? <Alert>{error}</Alert> : <Spinner />
        ) : (
          <>
            <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-slate-500">Estado</dt>
              <dd>
                {info.configured ? (
                  <Badge variant="success">Configurado</Badge>
                ) : (
                  <Badge variant="warning">Modo prueba (sin SMTP)</Badge>
                )}
              </dd>
              <dt className="text-slate-500">Remitente</dt>
              <dd className="break-all text-slate-800">{info.from}</dd>
              <dt className="text-slate-500">Servidor</dt>
              <dd className="text-slate-800">{info.host}</dd>
              <dt className="text-slate-500">Enlaces apuntan a</dt>
              <dd className="break-all text-slate-800">{info.app_url}</dd>
            </dl>
            {!info.configured && (
              <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200">
                Faltan SMTP_USER y SMTP_APP_PASSWORD en el .env del servidor. Mientras tanto los correos se muestran en la consola del backend.
              </p>
            )}
            <Alert>{error}</Alert>
            {result && <p className="text-sm text-accent-700">{result}</p>}
            <Button variant="outline" onClick={test} loading={sending}>
              <Send className="size-4" /> Enviarme un correo de prueba
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
