// Nivel de dependencia (mismos códigos que el enum dependency_level de la BD)
export const DEPENDENCY_LEVELS = [
  { value: 'AUTOVALENTE', label: 'Autovalente', short: 'Autovalente', badge: 'success' },
  { value: 'LEVE', label: 'Dependencia leve', short: 'Leve', badge: 'brand' },
  { value: 'MODERADA', label: 'Dependencia moderada', short: 'Moderada', badge: 'warning' },
  { value: 'SEVERA', label: 'Dependencia severa', short: 'Severa', badge: 'danger' },
];

export const dependencyOf = (value) => DEPENDENCY_LEVELS.find((d) => d.value === value);

export const PAYMENT_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
