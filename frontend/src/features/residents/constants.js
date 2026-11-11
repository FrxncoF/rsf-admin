// Índice de Katz: dependencia funcional (enum dependency_level de la BD)
export const DEPENDENCY_LEVELS = [
  { value: 'AUTOVALENTE', label: 'Autovalente', short: 'Autovalente', badge: 'success' },
  { value: 'LEVE', label: 'Dependencia leve', short: 'Leve', badge: 'brand' },
  { value: 'MODERADA', label: 'Dependencia moderada', short: 'Moderada', badge: 'warning' },
  { value: 'SEVERA', label: 'Dependencia severa', short: 'Severa', badge: 'danger' },
];

export const dependencyOf = (value) => DEPENDENCY_LEVELS.find((d) => d.value === value);

export const PAYMENT_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

// Previsión de salud (mismos códigos que el backend)
export const HEALTH_SYSTEMS = [
  { value: 'FONASA', label: 'Fonasa' },
  { value: 'ISAPRE', label: 'Isapre' },
];

// Isapres y ambulancias: catálogos editables en Soporte (ver useAppConfig)

// Índice de Pfeiffer: estado cognitivo
export const COGNITIVE_LEVELS = [
  { value: 'INTACTA', label: 'Función cognitiva intacta', short: 'Intacta', badge: 'success' },
  { value: 'LEVE', label: 'Deterioro cognitivo leve', short: 'Leve', badge: 'brand' },
  { value: 'MODERADO', label: 'Deterioro cognitivo moderado', short: 'Moderado', badge: 'warning' },
  { value: 'SEVERO', label: 'Deterioro cognitivo severo', short: 'Severo', badge: 'danger' },
];

// Escala de Norton: riesgo de úlceras por presión
export const PRESSURE_RISKS = [
  { value: 'MINIMO', label: 'Riesgo mínimo', short: 'Mínimo', badge: 'success' },
  { value: 'MEDIO', label: 'Riesgo medio', short: 'Medio', badge: 'brand' },
  { value: 'ALTO', label: 'Alto riesgo', short: 'Alto', badge: 'warning' },
  { value: 'MUY_ALTO', label: 'Muy alto riesgo', short: 'Muy alto', badge: 'danger' },
];

export const optionOf = (options, value) => options.find((o) => o.value === value);

/** "Fonasa" | "Isapre Banmédica" | "Dipreca" | null (`isapres` = catálogo de useAppConfig) */
export function healthLabel({ health_system: system, isapre }, isapres = []) {
  if (system === 'FONASA') return 'Fonasa';
  if (system === 'ISAPRE') {
    const option = isapres.find((i) => i.value === isapre);
    if (option?.standalone) return option.label;
    return `Isapre ${option?.label ?? isapre ?? ''}`.trim();
  }
  return null;
}
