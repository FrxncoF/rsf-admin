import { useCallback, useEffect, useId, useState } from 'react';
import { Pencil, Plus, Search, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Form';
import { Alert, EmptyState, Spinner } from '@/components/ui/Feedback';
import { ROLE_LABELS } from '@/components/layout/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

/** Gestión mínima de cuentas (ADMIN): crear cuidadoras, cambiar rol/estado y restablecer contraseña. */
export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState({ open: false, user: null });
  const [search, setSearch] = useState('');

  const normalize = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const term = normalize(search.trim());
  const visibleUsers = term
    ? users.filter((u) => normalize(u.full_name).includes(term) || normalize(u.email).includes(term))
    : users;

  const load = useCallback(() => {
    api
      .get('/users')
      .then(({ data }) => setUsers(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Usuarios</h1>
          <p className="mt-1 text-sm text-slate-500">Cuentas de acceso del personal</p>
        </div>
        <Button onClick={() => setDialog({ open: true, user: null })}>
          <Plus className="size-4" /> Nuevo usuario
        </Button>
      </div>

      <Alert>{error}</Alert>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          type="search"
          placeholder="Buscar por nombre o correo"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : users.length === 0 ? (
          <EmptyState icon={UserCog} title="Sin usuarios" />
        ) : visibleUsers.length === 0 ? (
          <EmptyState icon={Search} title="Sin resultados" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {visibleUsers.map((u) => (
              <li key={u.id} className="flex items-center gap-4 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium text-slate-900">{u.full_name}</p>
                    <Badge variant={u.role === 'ADMIN' ? 'brand' : 'default'}>{ROLE_LABELS[u.role]}</Badge>
                    {!u.is_active && <Badge variant="muted">Desactivado</Badge>}
                    {u.id === me.id && <span className="text-xs text-slate-400">(tú)</span>}
                  </div>
                  <p className="truncate text-sm text-slate-500">{u.email}</p>
                  <p className="text-xs text-slate-400">Último acceso: {formatDateTime(u.last_login_at)}</p>
                </div>
                <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setDialog({ open: true, user: u })}>
                  <Pencil className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <UserFormDialog
        open={dialog.open}
        user={dialog.user}
        isSelf={dialog.user?.id === me.id}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
        onSaved={() => {
          setDialog((d) => ({ ...d, open: false }));
          load();
        }}
      />
    </div>
  );
}

const EMPTY = { full_name: '', email: '', role: 'CUIDADORA', password: '', is_active: true };

function UserFormDialog({ open, user, isSelf, onClose, onSaved }) {
  const isEdit = Boolean(user);
  const formId = useId();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(user ? { ...EMPTY, ...user, password: '' } : EMPTY);
    setErrors({});
    setServerError('');
  }, [open, user]);

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setValues((v) => ({ ...v, [key]: value }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setServerError('');
    setErrors({});
    try {
      const { full_name, email, role, password, is_active } = values;
      if (isEdit) await api.patch(`/users/${user.id}`, { full_name, email, role, is_active, password });
      else await api.post('/users', { full_name, email, role, password });
      onSaved();
    } catch (err) {
      setServerError(err.message);
      if (err.details) setErrors(err.details);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar usuario' : 'Nuevo usuario'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} loading={saving}>
            Guardar
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <Alert>{serverError}</Alert>
        <Field label="Nombre completo" htmlFor="u_name" error={errors.full_name}>
          <Input id="u_name" required value={values.full_name} onChange={set('full_name')} />
        </Field>
        <Field label="Correo" htmlFor="u_email" error={errors.email}>
          <Input id="u_email" type="email" required value={values.email} onChange={set('email')} autoComplete="off" />
        </Field>
        <Field label="Rol" htmlFor="u_role" error={errors.role}>
          <Select id="u_role" value={values.role} onChange={set('role')} disabled={isSelf}>
            <option value="CUIDADORA">Cuidadora</option>
            <option value="ADMIN">Administradora</option>
          </Select>
        </Field>
        <Field
          label={isEdit ? 'Nueva contraseña' : 'Contraseña'}
          htmlFor="u_pass"
          error={errors.password}
          hint={isEdit ? 'Déjala en blanco para mantener la actual' : 'Mínimo 8 caracteres'}
        >
          <Input
            id="u_pass"
            type="password"
            required={!isEdit}
            minLength={8}
            value={values.password}
            onChange={set('password')}
            autoComplete="new-password"
          />
        </Field>
        {isEdit && !isSelf && (
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={values.is_active} onChange={set('is_active')} className="size-4 accent-brand-600" />
            Cuenta activa
          </label>
        )}
      </form>
    </Dialog>
  );
}
