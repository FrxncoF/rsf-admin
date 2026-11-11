import { useState } from 'react';
import { KeyRound, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Form';
import { Alert } from '@/components/ui/Feedback';
import { useAuth } from './AuthContext';

/** Tras un reinicio de clave por soporte: no se puede usar el sistema hasta definir una propia. */
export default function ForcePasswordChange() {
  const { user, updateProfile, logout } = useAuth();
  const [values, setValues] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!values.current) errs.current = 'Ingresa la clave temporal';
    if (values.next.length < 8) errs.next = 'Mínimo 8 caracteres';
    else if (values.next === values.current) errs.next = 'Debe ser distinta a la temporal';
    if (values.confirm !== values.next) errs.confirm = 'No coincide';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    setServerError('');
    try {
      await updateProfile({ current_password: values.current, new_password: values.next });
    } catch (err) {
      setServerError(err.message);
      if (err.details?.current_password) setErrors({ current: err.details.current_password });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <KeyRound className="size-6" />
          </span>
          <h1 className="text-lg font-semibold text-slate-900">Crea tu nueva contraseña</h1>
          <p className="text-sm text-slate-500">
            Hola {user.full_name.split(' ')[0]}, tu clave fue reiniciada. Para continuar, elige una nueva.
          </p>
        </div>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Alert>{serverError}</Alert>
          <Field label="Clave temporal" htmlFor="fp_current" error={errors.current}>
            <Input id="fp_current" type="password" autoComplete="current-password" value={values.current} onChange={set('current')} />
          </Field>
          <Field label="Nueva contraseña" htmlFor="fp_next" error={errors.next} hint="Mínimo 8 caracteres">
            <Input id="fp_next" type="password" autoComplete="new-password" value={values.next} onChange={set('next')} />
          </Field>
          <Field label="Repite la nueva contraseña" htmlFor="fp_confirm" error={errors.confirm}>
            <Input id="fp_confirm" type="password" autoComplete="new-password" value={values.confirm} onChange={set('confirm')} />
          </Field>
          <Button type="submit" className="w-full" loading={saving}>
            Guardar y continuar
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={logout}>
            <LogOut className="size-4" /> Salir
          </Button>
        </form>
      </Card>
    </div>
  );
}
