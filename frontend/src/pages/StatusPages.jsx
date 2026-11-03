import { Link } from 'react-router-dom';

function StatusPage({ code, title, description }) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-5xl font-bold text-brand-600">{code}</p>
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <Link
        to="/"
        className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Ir al inicio
      </Link>
    </div>
  );
}

export const ForbiddenPage = () => (
  <StatusPage code="403" title="Acceso restringido" description="Tu rol no tiene permiso para ver esta sección." />
);

export const NotFoundPage = () => (
  <StatusPage code="404" title="Página no encontrada" description="La dirección que buscas no existe." />
);
