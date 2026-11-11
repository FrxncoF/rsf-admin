import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';

const TIMEOUT_MS = 6_000;
const REFRESH_MS = 3 * 60 * 60 * 1000; // la UF cambia una vez al día; se refresca cada 3 h

// Fecha de hoy en Chile como YYYY-MM-DD
const todayInChile = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());

/**
 * API oficial de la CMF (requiere API key gratuita): https://api.cmfchile.cl/documentacion/UF.html
 * Responde { UFs: [{ Valor: "39.643,59", Fecha: "2026-11-05" }] } con formato numérico chileno.
 */
async function fromCmf() {
  const url = new URL('https://api.cmfchile.cl/api-sbifv3/recursos_api/uf');
  url.search = new URLSearchParams({ apikey: env.cmfApiKey, formato: 'json' });
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`CMF respondió ${res.status}`);
  const latest = (await res.json())?.UFs?.[0];
  if (!latest?.Valor) throw new Error('Respuesta de la CMF sin datos');
  const value = Number(latest.Valor.replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(value)) throw new Error(`Valor inesperado de la CMF: ${latest.Valor}`);
  return { value, date: latest.Fecha, source: 'CMF Chile' };
}

/** Respaldo: mindicador.cl, API pública sin registro que publica los datos del Banco Central. */
async function fromMindicador() {
  const res = await fetch('https://mindicador.cl/api/uf', { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`mindicador.cl respondió ${res.status}`);
  const latest = (await res.json())?.serie?.[0];
  if (!latest?.valor) throw new Error('Respuesta de mindicador.cl sin datos');
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date(latest.fecha));
  return { value: Number(latest.valor), date, source: 'Banco Central (vía mindicador.cl)' };
}

// Diagnóstico para la sección Soporte
const status = { lastCmfError: null, lastError: null };

async function fetchUf() {
  if (env.cmfApiKey) {
    try {
      return await fromCmf();
    } catch (err) {
      status.lastCmfError = { at: new Date().toISOString(), message: err.message };
      console.warn('[uf] CMF falló, se usa mindicador.cl:', err.message);
    }
  }
  return fromMindicador();
}

export function getUfStatus() {
  return {
    cmfConfigured: Boolean(env.cmfApiKey),
    cached: cache ? { ...publicView(cache), fetchedAt: new Date(cache.fetchedAtMs).toISOString() } : null,
    lastCmfError: status.lastCmfError,
    lastError: status.lastError,
  };
}

let cache = null; // { value, date, source, fetchedAtMs }
let inflight = null;

/** Valor de la UF del día. Si todas las fuentes fallan se devuelve el último valor conocido. */
export async function getUf() {
  const fresh = cache && cache.date === todayInChile() && Date.now() - cache.fetchedAtMs < REFRESH_MS;
  if (fresh) return publicView(cache);

  inflight ??= fetchUf()
    .then((uf) => {
      cache = { ...uf, fetchedAtMs: Date.now() };
      return cache;
    })
    .finally(() => {
      inflight = null;
    });

  try {
    return publicView(await inflight);
  } catch (err) {
    status.lastError = { at: new Date().toISOString(), message: err.message };
    console.warn('[uf] no se pudo actualizar:', err.message);
    if (cache) return { ...publicView(cache), stale: true };
    throw new AppError(503, 'No se pudo obtener el valor de la UF');
  }
}

const publicView = ({ value, date, source }) => ({ value, date, source });
