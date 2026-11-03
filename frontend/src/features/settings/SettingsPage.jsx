import { useState } from 'react';
import { CheckCircle2, KeyRound, LogOut, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Field, Input } from '@/components/ui/Form';
import { Alert } from '@/components/ui/Feedback';
import { ROLE_LABELS } from '@/components/layout/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { initials } from '@/lib/utils';

/** Configuración de la cuenta propia: datos de perfil y cambio de contraseña. */
export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [first = '', ...rest] = user.full_name.split(' ');
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await logout(); // al quedar sin usuario, RequireAuth redirige al login
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Configuración</h1>
        <p className="mt-1 text-sm text-slate-500">Administra los datos de tu cuenta</p>
      </div>

      <Card className="flex items-center gap-4 p-5">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700">
          {initials(first, rest.join(' '))}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-slate-900">{user.full_name}</p>
          <p className="truncate text-sm text-slate-500">
            {user.email} · <span className="text-accent-700">{ROLE_LABELS[user.role]}</span>
          </p>
        </div>
      </Card>

      <ProfileForm />
      <PasswordForm />

      <div className="flex justify-center pt-2">
        <Button
          variant="outline"
          className="w-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
          onClick={() => setConfirmLogout(true)}
        >
          <LogOut className="size-4" /> Cerrar sesión
        </Button>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={handleLogout}
        loading={loggingOut}
        destructive
        title="Cerrar sesión"
        description="¿Realmente deseas cerrar sesión? Tendrás que volver a ingresar tu correo y contraseña."
        confirmLabel="Sí, cerrar sesión"
      />
    </div>
  );
}

function SavedMessage({ children }) {
  if (!children) return null;
  return (
    <p className="flex items-center gap-2 text-sm text-accent-700">
      <CheckCircle2 className="size-4" /> {children}
    </p>
  );
}

function ProfileForm() {
  const { user, updateProfile } = useAuth();
  const [values, setValues] = useState({ full_name: user.full_name, email: user.email, current_password: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);

  const emailChanged = values.email.trim().toLowerCase() !== user.email;
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setServerError('');
    setSaved('');
    try {
      const payload = { full_name: values.full_name, email: values.email };
      if (emailChanged) payload.current_password = values.current_password;
      await updateProfile(payload);
      setValues((v) => ({ ...v, current_password: '' }));
      setSaved('Perfil actualizado');
    } catch (err) {
      setServerError(err.message);
      if (err.details) setErrors(err.details);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRound className="size-5 text-brand-600" /> Perfil
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Alert>{serverError}</Alert>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre completo" htmlFor="p_name" error={errors.full_name}>
              <Input id="p_name" required value={values.full_name} onChange={set('full_name')} autoComplete="name" />
            </Field>
            <Field label="Correo" htmlFor="p_email" error={errors.email}>
              <Input id="p_email" type="email" required value={values.email} onChange={set('email')} autoComplete="email" />
            </Field>
          </div>
          {emailChanged && (
            <Field
              label="Contraseña actual"
              htmlFor="p_current"
              error={errors.current_password}
              hint="Necesaria para cambiar el correo"
            >
              <Input
                id="p_current"
                type="password"
                required
                value={values.current_password}
                onChange={set('current_password')}
                autoComplete="current-password"
              />
            </Field>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <SavedMessage>{saved}</SavedMessage>
            <Button type="submit" loading={saving}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

const EMPTY_PASSWORDS = { current_password: '', new_password: '', confirm: '' };

function PasswordForm() {
  const { updateProfile } = useAuth();
  const [values, setValues] = useState(EMPTY_PASSWORDS);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});
    setServerError('');
    setSaved('');
    if (values.new_password !== values.confirm) {
      setErrors({ confirm: 'Las contraseñas no coinciden' });
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ current_password: values.current_password, new_password: values.new_password });
      setValues(EMPTY_PASSWORDS);
      setSaved('Contraseña actualizada');
    } catch (err) {
      setServerError(err.message);
      if (err.details) setErrors(err.details);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-5 text-brand-600" /> Cambiar contraseña
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Alert>{serverError}</Alert>
          <Field label="Contraseña actual" htmlFor="pw_current" error={errors.current_password}>
            <Input
              id="pw_current"
              type="password"
              required
              value={values.current_password}
              onChange={set('current_password')}
              autoComplete="current-password"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nueva contraseña" htmlFor="pw_new" error={errors.new_password} hint="Mínimo 8 caracteres">
              <Input
                id="pw_new"
                type="password"
                required
                minLength={8}
                value={values.new_password}
                onChange={set('new_password')}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Repetir nueva contraseña" htmlFor="pw_confirm" error={errors.confirm}>
              <Input
                id="pw_confirm"
                type="password"
                required
                minLength={8}
                value={values.confirm}
                onChange={set('confirm')}
                autoComplete="new-password"
              />
            </Field>
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <SavedMessage>{saved}</SavedMessage>
            <Button type="submit" loading={saving}>
              Actualizar contraseña
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
