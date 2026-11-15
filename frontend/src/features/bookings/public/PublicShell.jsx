import { useEffect } from 'react';
import { Link } from 'react-router-dom';

/** Marco de las páginas públicas de reservas (sin menú ni sesión). */
export function PublicShell({ title, children }) {
  useEffect(() => {
    document.title = `${title} · Residencia San Francisco`;
  }, [title]);

  return (
    <div className="min-h-dvh bg-gradient-to-br from-brand-50 via-white to-accent-50 px-4 py-6">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-5 flex flex-col items-center text-center">
          <Link to="/reservar" aria-label="Inicio de reservas">
            <img src="/icons/logo.png" alt="Residencia San Francisco · Cuidamos de ti" className="h-auto w-52" />
          </Link>
          <h1 className="mt-3 text-xl font-semibold text-brand-800">{title}</h1>
        </header>
        <main className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">{children}</main>
        <footer className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <Link to="/reservar" className="hover:text-brand-700">
            Reservar visita
          </Link>
          <Link to="/reservar/cancelar" className="hover:text-brand-700">
            Cancelar una reserva
          </Link>
          <Link to="/reservar/privacidad" className="hover:text-brand-700">
            Privacidad de tus datos
          </Link>
        </footer>
      </div>
    </div>
  );
}
