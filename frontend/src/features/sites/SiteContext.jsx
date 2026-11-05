import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

const STORAGE_KEY = 'rsf:site';
const SiteContext = createContext(null);

function readStored() {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/**
 * Sede seleccionada globalmente (barra superior). `siteId = null` significa "Todas".
 * Se recuerda por navegador para que cada equipo quede en su sede habitual.
 */
export function SiteProvider({ children }) {
  const [sites, setSites] = useState([]);
  const [siteId, setSiteIdState] = useState(readStored);

  useEffect(() => {
    api
      .get('/sites')
      .then(({ data }) => {
        setSites(data);
        // Si la sede guardada ya no existe, se vuelve a "Todas"
        setSiteIdState((current) => (current && !data.some((s) => s.id === current) ? null : current));
      })
      .catch(() => setSites([]));
  }, []);

  const setSiteId = useCallback((id) => {
    setSiteIdState(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, String(id));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* almacenamiento no disponible: solo dura la sesión */
    }
  }, []);

  const value = useMemo(
    () => ({ sites, siteId, setSiteId, currentSite: sites.find((s) => s.id === siteId) ?? null }),
    [sites, siteId, setSiteId],
  );

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSites() {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error('useSites debe usarse dentro de <SiteProvider>');
  return ctx;
}
