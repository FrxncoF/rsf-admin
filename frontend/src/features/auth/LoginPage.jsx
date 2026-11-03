import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Form';
import { Alert } from '@/components/ui/Feedback';
import { useAuth } from './AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-brand-50 via-white to-accent-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/icons/logo.png" alt="Residencia San Francisco · Cuidamos de ti" className="h-auto w-64" />
          <h1 className="sr-only">Residencia San Francisco</h1>
          <p className="mt-3 text-sm font-medium text-brand-700">Gestión de la residencia</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Alert>{error}</Alert>
          <Field label="Correo" htmlFor="email">
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              required
              className="h-12 text-base"
              value={form.email}
              onChange={set('email')}
            />
          </Field>
          <Field label="Contraseña" htmlFor="password">
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              className="h-12 text-base"
              value={form.password}
              onChange={set('password')}
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={loading}>
            Ingresar
          </Button>
        </form>
      </div>
    </div>
  );
}
