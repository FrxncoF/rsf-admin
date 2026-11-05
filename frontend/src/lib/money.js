import { useEffect, useState } from 'react';
import { api } from './api';

const clp = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const ufNumber = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 41274.2 → "$41.274" (valor de la UF, solo pesos; el cálculo usa el valor exacto) */
export const formatUfValue = (value) => clp.format(Math.round(value));

/** 28.5 → "28,50 UF" */
export const formatUf = (value) => (value == null ? '—' : `${ufNumber.format(value)} UF`);

/** 1176314.7 → "$1.176.315" */
export const formatClp = (value) => (value == null ? '—' : clp.format(Math.round(value)));

/** "28,5" | "28.5" → 28.5 ; texto inválido → NaN */
export const parseUfInput = (text) => (String(text).trim() === '' ? NaN : Number(String(text).replace(',', '.')));

// Una sola petición por carga de página; el backend además cachea el valor del día
let ufPromise = null;
const loadUf = () => {
  ufPromise ??= api
    .get('/indicators/uf')
    .then(({ data }) => data)
    .catch((err) => {
      ufPromise = null; // se reintenta en el próximo uso
      throw err;
    });
  return ufPromise;
};

/** { uf: { value, date, source } | null, error } */
export function useUf() {
  const [state, setState] = useState({ uf: null, error: '' });
  useEffect(() => {
    let alive = true;
    loadUf()
      .then((uf) => alive && setState({ uf, error: '' }))
      .catch((err) => alive && setState({ uf: null, error: err.message }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
