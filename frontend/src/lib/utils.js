import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function initials(firstName = '', lastName = '') {
  return `${firstName.trim()[0] ?? ''}${lastName.trim()[0] ?? ''}`.toUpperCase();
}

/** Edad en años a partir de 'YYYY-MM-DD' */
export function ageFrom(isoDate) {
  if (!isoDate) return null;
  const [y, m, d] = isoDate.split('-').map(Number);
  const today = new Date();
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age;
}

export function formatDate(isoDate) {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  return `${d}-${m}-${y}`;
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export function roomLabel({ room, bed }) {
  return bed ? `Hab. ${room} · Cama ${bed}` : `Hab. ${room}`;
}

/** "El Curato · Hab. 9 · Cama A" */
export function locationLabel(resident) {
  return resident.site_name ? `${resident.site_name} · ${roomLabel(resident)}` : roomLabel(resident);
}
