// Cliente HTTP mínimo. La sesión viaja en una cookie httpOnly (same-origin vía Nginx/Vite proxy).

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const UNAUTHORIZED_EVENT = 'auth:unauthorized';

async function request(method, path, { body, params, signal } = {}) {
  const url = new URL(`/api${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    }
  }

  const isForm = body instanceof FormData;
  const res = await fetch(url, {
    method,
    credentials: 'include',
    signal,
    headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Sesión expirada en cualquier llamada (excepto login/me): avisamos al AuthContext
    if (res.status === 401 && !path.startsWith('/auth/')) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(res.status, data.error || 'Error inesperado', data.details);
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
