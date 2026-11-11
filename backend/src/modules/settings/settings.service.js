import { query } from '../../db/pool.js';
import { AppError } from '../../utils/AppError.js';

// Caché en memoria: la configuración se lee en cada formulario y cambia muy poco
let cache = null;

async function loadAll() {
  if (!cache) {
    const { rows } = await query('SELECT key, value, updated_at FROM app_settings');
    cache = Object.fromEntries(rows.map((r) => [r.key, { ...wrap(r.value), updated_at: r.updated_at }]));
  }
  return cache;
}

// Los catálogos son arreglos; se envuelven para poder adjuntar updated_at
const wrap = (value) => (Array.isArray(value) ? { items: value } : value);
const unwrap = (key, setting) => (CATALOGS.includes(key) ? setting.items : setting);

export const CATALOGS = ['isapres', 'ambulances'];

export async function getSetting(key) {
  const all = await loadAll();
  if (!all[key]) throw AppError.notFound('Configuración no encontrada');
  return unwrap(key, all[key]);
}

export async function setSetting(key, value, userId) {
  await query(
    `INSERT INTO app_settings (key, value, updated_by, updated_at) VALUES ($1, $2, $3, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [key, JSON.stringify(value), userId],
  );
  cache = null;
  return getSetting(key);
}

/** Lo que necesita cualquier pantalla (también el login): aviso superior y catálogos. */
export async function getPublicSettings() {
  const all = await loadAll();
  const banner = all.banner ?? { enabled: false };
  return {
    banner: banner.enabled ? { message: banner.message, tone: banner.tone, dismissible: banner.dismissible, id: banner.updated_at } : null,
    catalogs: Object.fromEntries(CATALOGS.map((k) => [k, all[k]?.items ?? []])),
  };
}

/** Valida que `value` exista en el catálogo (activo, o el valor que ya tenía el registro). */
export async function assertCatalogValue(catalog, value, { current, field, label }) {
  if (value == null) return;
  const item = (await getSetting(catalog)).find((i) => i.value === value);
  if (!item || (!item.active && value !== current)) {
    throw AppError.badRequest('Datos inválidos', { [field]: `Selecciona ${label} de la lista` });
  }
}
