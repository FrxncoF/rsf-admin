// Catálogos de la ficha diaria. Los `value` son los códigos guardados en BD (validados en
// backend/src/modules/daily-logs/dailyLogs.validators.js); los `label` son solo de presentación.

export const SECTIONS = {
  vitals: 'Signos vitales',
  intake: 'Alimentación e hidratación',
  hygiene: 'Higiene y esfínteres',
  skin: 'Piel, movilidad y posición',
  wellbeing: 'Ánimo, sueño y eventos',
};

// tone: color del botón seleccionado (ver TONES en controls.jsx)
export const MOODS = [
  { value: 'alegre', label: 'Alegre', emoji: '😄', tone: 'good' },
  { value: 'tranquilo', label: 'Tranquilo', emoji: '🙂', tone: 'good' },
  { value: 'apatico', label: 'Apático', emoji: '😐', tone: 'neutral' },
  { value: 'triste', label: 'Triste', emoji: '😢', tone: 'warn' },
  { value: 'ansioso', label: 'Ansioso', emoji: '😟', tone: 'warn' },
  { value: 'confuso', label: 'Confuso', emoji: '😵‍💫', tone: 'warn' },
  { value: 'irritable', label: 'Irritable', emoji: '😠', tone: 'bad' },
];
export const moodByValue = (value) => MOODS.find((m) => m.value === value);

export const MEALS = [
  { key: 'desayuno', label: 'Desayuno', icon: '🌅' },
  { key: 'almuerzo', label: 'Almuerzo', icon: '🍲' },
  { key: 'once', label: 'Once', icon: '☕' },
  { key: 'cena', label: 'Cena', icon: '🌙' },
];

export const INTAKE = [
  { value: '100', label: '100%', tone: 'good' },
  { value: '75', label: '75%', tone: 'good' },
  { value: '50', label: '50%', tone: 'neutral' },
  { value: '25', label: '25%', tone: 'warn' },
  { value: 'rechaza', label: 'Rechaza', tone: 'bad' },
];

export const HYDRATION = [
  { value: 'lt500', label: '< 500 ml', tone: 'bad' },
  { value: '500-1000', label: '500–1000', tone: 'warn' },
  { value: '1000-1500', label: '1000–1500', tone: 'good' },
  { value: '1500-2000', label: '1500–2000', tone: 'good' },
  { value: 'gt2000', label: '> 2000 ml', tone: 'neutral' },
];

export const DYSPHAGIA = [
  { value: 'normal', label: 'Normal', hint: 'Dieta común', tone: 'good' },
  { value: 'leve', label: 'Leve', hint: 'Picado fino', tone: 'neutral' },
  { value: 'moderada', label: 'Moderada', hint: 'Papilla', tone: 'warn' },
  { value: 'severa', label: 'Severa', hint: 'Espesante', tone: 'bad' },
];

export const DIURESIS_FREQ = [
  { value: 'normal', label: 'Normal', tone: 'good' },
  { value: 'aumentada', label: 'Aumentada', tone: 'warn' },
  { value: 'disminuida', label: 'Disminuida', tone: 'warn' },
  { value: 'anuria', label: 'Sin orina', tone: 'bad' },
];

export const DIURESIS_ASPECT = [
  { value: 'clara', label: 'Clara', swatch: 'bg-yellow-100', tone: 'good' },
  { value: 'concentrada', label: 'Concentrada', swatch: 'bg-amber-400', tone: 'warn' },
  { value: 'turbia', label: 'Turbia', swatch: 'bg-stone-300', tone: 'warn' },
  { value: 'hematurica', label: 'Con sangre', swatch: 'bg-red-400', tone: 'bad' },
];

// Escala de Bristol simplificada: número grande + palabra clave
export const BRISTOL = [
  { value: 1, label: 'Bolitas duras', group: 'Estreñimiento', tone: 'warn' },
  { value: 2, label: 'Dura', group: 'Estreñimiento', tone: 'warn' },
  { value: 3, label: 'Con grietas', group: 'Normal', tone: 'good' },
  { value: 4, label: 'Suave', group: 'Normal', tone: 'good' },
  { value: 5, label: 'Trozos blandos', group: 'Blanda', tone: 'neutral' },
  { value: 6, label: 'Pastosa', group: 'Diarrea', tone: 'bad' },
  { value: 7, label: 'Líquida', group: 'Diarrea', tone: 'bad' },
];

export const HYGIENE = [
  { value: 'ducha', label: 'Ducha', icon: '🚿' },
  { value: 'cama', label: 'Aseo en cama', icon: '🛏️' },
  { value: 'bucal', label: 'Aseo bucal', icon: '🪥' },
];

export const SKIN = [
  { value: 'sana', label: 'Sana', tone: 'good', exclusive: true },
  { value: 'seca', label: 'Seca', tone: 'neutral' },
  { value: 'eritema', label: 'Eritema', tone: 'warn', needsZone: true },
  { value: 'hematoma', label: 'Hematoma', tone: 'warn', needsZone: true },
  { value: 'herida', label: 'Herida', tone: 'bad', needsZone: true },
  { value: 'escara_nueva', label: 'Escara nueva', tone: 'bad', needsZone: true },
  { value: 'escara_tto', label: 'Escara en tto.', tone: 'warn', needsZone: true },
];

export const SKIN_ZONES = ['Sacro', 'Glúteos', 'Talones', 'Caderas', 'Codos', 'Espalda', 'Piernas', 'Brazos', 'Otra'];

export const MOBILITY = [
  { value: 'autovalente', label: 'Autovalente', tone: 'good' },
  { value: 'ayuda_tecnica', label: 'Ayuda técnica', hint: 'Bastón / andador', tone: 'neutral' },
  { value: 'asistido', label: 'Asistido', hint: 'Con cuidadora', tone: 'warn' },
  { value: 'postrado', label: 'Postrado', tone: 'bad' },
];

export const POSITIONS = [
  { value: 'supino', label: 'Boca arriba' },
  { value: 'lateral_izq', label: 'Lateral izq.' },
  { value: 'lateral_der', label: 'Lateral der.' },
  { value: 'sentado', label: 'Sentado' },
];

export const POSTURE_INTERVAL_MIN = 120;

export const SLEEP = [
  { value: 'bien', label: 'Durmió bien', emoji: '😴', tone: 'good' },
  { value: 'despertares', label: 'Despertares', emoji: '🌗', tone: 'neutral' },
  { value: 'insomnio', label: 'Insomnio', emoji: '👀', tone: 'warn' },
  { value: 'agitado', label: 'Agitado', emoji: '😣', tone: 'bad' },
];

export const SLEEP_SHIFTS = [
  { key: 'noche', label: 'Turno noche' },
  { key: 'dia', label: 'Siesta / turno día' },
];

export const ALERTS = [
  { value: 'caida', label: 'Caída', emoji: '⚠️', critical: true },
  { value: 'dolor', label: 'Dolor', emoji: '🤕', critical: true },
  { value: 'vomitos', label: 'Vómitos', emoji: '🤢', critical: true },
  { value: 'fiebre', label: 'Fiebre', emoji: '🌡️', critical: true },
];

export const NOTES_MAX = 150;

/**
 * Signos vitales. `min`/`max` = límites duros (evitan errores de tipeo);
 * `low`/`high` = fuera de rango clínico habitual → se marca en ámbar.
 */
export const VITALS = [
  { key: 'pa_s', label: 'PA sist.', unit: 'mmHg', min: 50, max: 260, low: 90, high: 140 },
  { key: 'pa_d', label: 'PA diast.', unit: 'mmHg', min: 30, max: 160, low: 50, high: 90 },
  { key: 'fc', label: 'FC', unit: 'lpm', min: 20, max: 250, low: 50, high: 100 },
  { key: 'temp', label: 'Temp.', unit: '°C', min: 30, max: 43, low: 35.5, high: 37.5, decimal: true },
  { key: 'spo2', label: 'SpO₂', unit: '%', min: 50, max: 100, low: 92 },
];

export const labelOf = (options, value) => options.find((o) => o.value === value)?.label ?? value;
