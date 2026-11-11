// Cliente HTTP mínimo. La sesión viaja en una cookie httpOnly (same-origin vía Nginx/Vite proxy).

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const UNAUTHORIZED_EVENT = 'auth:unauthorized';

// Mensajes para respuestas que no vienen del backend (Nginx, red caída, etc.)
const STATUS_MESSAGES = {
  413: 'El archivo es demasiado grande para subirlo',
  502: 'El servidor no está disponible en este momento. Intenta en unos minutos.',
  503: 'El servidor no está disponible en este momento. Intenta en unos minutos.',
  504: 'El servidor tardó demasiado en responder. Intenta nuevamente.',
};

async function request(method, path, { body, params, signal, timeoutMs } = {}) {
  const url = new URL(`/api${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    }
  }

  const isForm = body instanceof FormData;
  // timeoutMs: corta peticiones lentas (ej. subida de fotos con mala señal)
  const signals = [signal, timeoutMs && AbortSignal.timeout(timeoutMs)].filter(Boolean);
  let res;
  try {
    res = await fetch(url, {
      method,
      credentials: 'include',
      // AbortSignal.any no existe en navegadores antiguos: ahí se prioriza el timeout
      signal: signals.length > 1 && AbortSignal.any ? AbortSignal.any(signals) : signals.at(-1),
      headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
  } catch (err) {
    if (err.name === 'TimeoutError') throw new ApiError(0, 'La conexión está lenta y se canceló la espera. Intenta nuevamente.');
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'No hay conexión con el servidor. Revisa tu internet.');
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Sesión expirada en cualquier llamada (excepto login/me): avisamos al AuthContext
    if (res.status === 401 && !path.startsWith('/auth/')) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(res.status, data.error || STATUS_MESSAGES[res.status] || `Error inesperado (${res.status})`, data.details);
  }
  return data;
}

export const api = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { ...opts, body }),
  put: (path, body, opts) => request('PUT', path, { ...opts, body }),
  patch: (path, body, opts) => request('PATCH', path, { ...opts, body }),
  delete: (path, opts) => request('DELETE', path, opts),
};
