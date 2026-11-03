import { useCallback, useEffect, useState } from 'react';
import { residentsApi } from './residentsApi';

/** Carga la lista de residentes y se recarga cuando cambian los filtros. */
export function useResidents(params) {
  const [state, setState] = useState({ data: [], meta: null, loading: true, error: '' });
  const [reloadKey, setReloadKey] = useState(0);
  const key = JSON.stringify(params);

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: '' }));
    residentsApi
      .list(JSON.parse(key), { signal: controller.signal })
      .then(({ data, meta }) => setState({ data, meta, loading: false, error: '' }))
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setState((s) => ({ ...s, loading: false, error: err.message }));
      });
    return () => controller.abort();
  }, [key, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  return { ...state, reload };
}
