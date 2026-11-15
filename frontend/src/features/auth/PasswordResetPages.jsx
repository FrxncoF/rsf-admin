import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Form';
import { Alert, Spinner } from '@/components/ui/Feedback';
import { api } from '@/lib/api';

/** Mismo marco que el login: logo y una tarjeta. */
function AuthShell({ title, children }) {
  useEffect(() => {
    document.title = `${title} · Residencia San Francisco`;
  }, [title]);
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-brand-50 via-white to-accent-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/icons/logo.png" alt="Residencia San Francisco · Cuidamos de ti" className="h-auto w-56" />
          <h1 className="mt-3 text-lg font-semibold text-brand-800">{title}</h1>
        </div>
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
        <Link to="/login" className="mt-4 flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-brand-700">
          <ArrowLeft className="size-4" /> Volver a iniciar sesión
        </Link>
      </div>
    </div>
  );
}

/** /olvide-contrasena — pide el correo y envía el enlace (respuesta igual exista o no la cuenta). */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthShell title="Revisa tu correo">
        <div className="space-y-3 text-center">
          <MailCheck className="mx-auto size-12 text-accent-600" />
          <p className="text-sm text-slate-700">
            Si <strong>{email.trim()}</strong> está registrado, te enviamos un enlace para elegir una nueva contraseña.
          </p>
          <p className="text-xs text-slate-500">El enlace vence en 30 minutos. Si no lo ves, revisa la carpeta de spam o correo no deseado.</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="¿Olvidaste tu contraseña?">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-600">Escribe el correo con que entras al sistema y te enviaremos un enlace para elegir una nueva.</p>
        <Alert>{error}</Alert>
        <Field label="Correo" htmlFor="email">
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            required
            className="h-12 text-base"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Enviar enlace
        </Button>
      </form>
    </AuthShell>
  );
}

/** /restablecer-contrasena?token=… — elige la nueva clave con el enlace del correo. */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [valid, setValid] = useState(null); // null = revisando
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return setValid(false);
    api
      .post('/auth/reset-password/check', { token })
      .then((r) => setValid(r.valid))
      .catch(() => setValid(false));
  }, [token]);

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (form.password.length < 8) errs.password = 'Mínimo 8 caracteres';
    if (form.confirm !== form.password) errs.confirm = 'Las contraseñas no coinciden';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password: form.password });
      setDone(true);
    } catch (err) {
      setError(err.message);
      if (err.status === 400 && /venci|usado/i.test(err.message)) setValid(false);
    } finally {
      setLoading(false);
    }
  }

  if (valid === null) {
    return (
      <AuthShell title="Restablecer contraseña">
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="Contraseña actualizada">
        <div className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto size-12 text-accent-600" />
          <p className="text-sm text-slate-700">Ya puedes entrar con tu nueva contraseña. Por seguridad, cerramos las sesiones que tenías abiertas.</p>
          <Button size="lg" className="w-full" onClick={() => navigate('/login', { replace: true })}>
            Iniciar sesión
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (!valid) {
    return (
      <AuthShell title="Enlace no válido">
        <div className="space-y-4 text-center">
          <p className="text-sm text-slate-700">Este enlace venció o ya fue usado. Los enlaces sirven una sola vez y duran 30 minutos.</p>
          <Button size="lg" className="w-full" onClick={() => navigate('/olvide-contrasena')}>
            Pedir un enlace nuevo
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Elige tu nueva contraseña">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Alert>{error}</Alert>
        <Field label="Nueva contraseña" htmlFor="password" error={errors.password} hint="Mínimo 8 caracteres">
          <div className="relative">
            <Input
              id="password"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              className="h-12 pr-11 text-base"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              aria-invalid={!!errors.password || undefined}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
        </Field>
        <Field label="Repite la contraseña" htmlFor="confirm" error={errors.confirm}>
          <Input
            id="confirm"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            className="h-12 text-base"
            value={form.confirm}
            onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
            aria-invalid={!!errors.confirm || undefined}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Guardar contraseña
        </Button>
      </form>
    </AuthShell>
  );
}
