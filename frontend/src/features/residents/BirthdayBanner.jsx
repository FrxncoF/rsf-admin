import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { api } from '@/lib/api';
import { useSites } from '@/features/sites/SiteContext';

const DISMISS_KEY = 'rsf:birthday-dismissed';
const todayKey = () => new Date().toLocaleDateString('en-CA');

// "Ana", "Ana y Luis", "Ana, Luis y Rosa"
function joinNames(items) {
  return items.flatMap((item, i) => {
    const sep = i === 0 ? null : i === items.length - 1 ? ' y ' : ', ';
    return sep ? [sep, item] : [item];
  });
}

/**
 * Aviso rosado con los cumpleaños del día (residentes activos de la sede elegida).
 * Se cierra con la X y vuelve a aparecer al día siguiente si hay otro cumpleaños.
 */
export function BirthdayBanner() {
  const { siteId } = useSites();
  const [people, setPeople] = useState([]);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .get('/residents/birthdays/today', { params: { site_id: siteId ?? undefined } })
        .then(({ data }) => alive && setPeople(data))
        .catch(() => alive && setPeople([]));
    load();
    // Cambia el día con la app abierta (turno de noche)
    const id = setInterval(load, 60 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [siteId]);

  if (people.length === 0 || dismissed === todayKey()) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, todayKey());
    } catch {
      /* sin almacenamiento: se oculta solo en esta vista */
    }
    setDismissed(todayKey());
  };

  const names = people.map((p) => (
    <Link key={p.id} to={`/residentes/${p.id}`} className="font-semibold underline decoration-white/50 underline-offset-2 hover:decoration-white">
      {p.first_name.split(' ')[0]} {p.last_name.split(' ')[0]}
      <span className="font-normal opacity-90"> ({p.age} años)</span>
    </Link>
  ));

  return (
    <div
      role="status"
      className="relative flex items-center gap-3 bg-pink-500 px-4 py-2.5 text-sm text-white shadow-sm"
    >
      <span className="hidden text-2xl leading-none sm:block" aria-hidden="true">
        🎂
      </span>
      <p className="flex-1 text-center leading-snug">
        <span className="mr-1 sm:hidden" aria-hidden="true">
          🎂
        </span>
        <span className="font-bold">¡Feliz cumpleaños</span>
        {people.length === 1 ? ', ' : ' a '}
        {joinNames(names)}
        <span className="font-bold">!</span> {people.length === 1 ? 'Que tenga' : 'Que tengan'} un día lleno de cariño{' '}
        <span aria-hidden="true">🎉🎈</span>
      </p>
      <button type="button" onClick={dismiss} aria-label="Cerrar aviso de cumpleaños" className="rounded p-1 opacity-80 hover:bg-white/20 hover:opacity-100">
        <X className="size-4" />
      </button>
    </div>
  );
}
