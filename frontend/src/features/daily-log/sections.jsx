import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bath, Clock, HeartPulse, Plus, RotateCcw, Smile, Utensils } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import {
  ALERTS,
  BRISTOL,
  DIURESIS_ASPECT,
  DIURESIS_FREQ,
  DYSPHAGIA,
  HYDRATION,
  HYGIENE,
  INTAKE,
  MEALS,
  MOBILITY,
  MOODS,
  NOTES_MAX,
  POSITIONS,
  POSTURE_INTERVAL_MIN,
  SECTIONS,
  SKIN,
  SKIN_ZONES,
  SLEEP,
  SLEEP_SHIFTS,
  VITALS,
  labelOf,
} from './options';
import { ChoiceGroup, FieldGroup, MultiChoice, OptionButton, SectionCard, Stepper } from './controls';
import { formatTime, shortName } from './useDailyLog';

const toggleIn = (list, value, on) => (on ? [...list, value] : list.filter((v) => v !== value));

/* ───────────────────────── 1 · Signos vitales ───────────────────────── */

const EMPTY_VITALS = Object.fromEntries(VITALS.map((v) => [v.key, '']));

function vitalStatus(def, raw) {
  if (raw === '' || raw == null) return 'empty';
  const n = Number(raw);
  if (Number.isNaN(n) || n < def.min || n > def.max) return 'invalid';
  if ((def.low != null && n < def.low) || (def.high != null && n >= def.high)) return 'alert';
  return 'ok';
}

export function VitalsSection({ log, addVitals, lastEdit, onShowHistory }) {
  const [draft, setDraft] = useState(EMPTY_VITALS);
  const statuses = useMemo(() => Object.fromEntries(VITALS.map((d) => [d.key, vitalStatus(d, draft[d.key])])), [draft]);
  const values = Object.values(statuses);
  const canSave = values.some((s) => s !== 'empty') && !values.includes('invalid');

  const setValue = (def) => (e) => {
    const clean = e.target.value.replace(',', '.').replace(def.decimal ? /[^\d.]/g : /\D/g, '');
    setDraft((d) => ({ ...d, [def.key]: clean.slice(0, def.decimal ? 4 : 3) }));
  };

  function save() {
    const values = Object.fromEntries(
      Object.entries(draft).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)]),
    );
    addVitals(values, `Control: ${describeVitals(values)}`);
    setDraft(EMPTY_VITALS);
  }

  return (
    <SectionCard id="vitals" icon={HeartPulse} title={SECTIONS.vitals} lastEdit={lastEdit} onShowHistory={onShowHistory}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {VITALS.map((def) => {
          const status = statuses[def.key];
          return (
            <label key={def.key} className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">{def.label}</span>
              <div
                className={cn(
                  'flex h-14 items-center rounded-xl border-2 bg-white px-3 transition focus-within:ring-2',
                  status === 'invalid' && 'border-red-400 focus-within:ring-red-500/30',
                  status === 'alert' && 'border-amber-400 bg-amber-50 focus-within:ring-amber-500/30',
                  status === 'ok' && 'border-accent-400 focus-within:ring-accent-500/30',
                  status === 'empty' && 'border-slate-200 focus-within:border-brand-500 focus-within:ring-brand-500/30',
                )}
              >
                <input
                  inputMode={def.decimal ? 'decimal' : 'numeric'}
                  value={draft[def.key]}
                  onChange={setValue(def)}
                  placeholder="—"
                  aria-invalid={status === 'invalid' || undefined}
                  className="w-full min-w-0 bg-transparent text-xl font-semibold tabular-nums text-slate-900 placeholder:text-slate-300 focus:outline-none"
                />
                <span className="shrink-0 text-xs text-slate-400">{def.unit}</span>
              </div>
              {status === 'invalid' && <span className="mt-1 block text-[11px] text-red-600">Fuera de rango</span>}
              {status === 'alert' && <span className="mt-1 block text-[11px] text-amber-700">Valor a vigilar</span>}
            </label>
          );
        })}
      </div>

      <Button size="lg" className="w-full" disabled={!canSave} onClick={save}>
        <Plus className="size-5" /> Registrar control
      </Button>

      {log.vitals.length > 0 && (
        <FieldGroup title={`Controles de hoy (${log.vitals.length})`}>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {log.vitals.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-sm">
                <span className="font-semibold tabular-nums text-brand-700">{formatTime(v.at)}</span>
                <span className="flex-1 tabular-nums text-slate-700">{describeVitals(v)}</span>
                <span className="text-xs text-slate-400">{shortName(v.by)}</span>
              </li>
            ))}
          </ul>
        </FieldGroup>
      )}
    </SectionCard>
  );
}

function describeVitals(v) {
  const parts = [];
  if (v.pa_s || v.pa_d) parts.push(`PA ${v.pa_s ?? '—'}/${v.pa_d ?? '—'}`);
  if (v.fc) parts.push(`FC ${v.fc}`);
  if (v.temp) parts.push(`T° ${v.temp}`);
  if (v.spo2) parts.push(`SpO₂ ${v.spo2}%`);
  if (v.hgt) parts.push(`HGT ${v.hgt}`);
  return parts.join(' · ');
}

/* ─────────────────── 2 · Alimentación e hidratación ─────────────────── */

export function IntakeSection({ log, update, lastEdit, onShowHistory }) {
  return (
    <SectionCard id="intake" icon={Utensils} title={SECTIONS.intake} lastEdit={lastEdit} onShowHistory={onShowHistory}>
      <FieldGroup title="Ingesta por comida">
        <div className="space-y-3">
          {MEALS.map((meal) => (
            <div key={meal.key} className="grid gap-2 sm:grid-cols-[7.5rem_1fr] sm:items-center">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <span aria-hidden="true">{meal.icon}</span> {meal.label}
              </span>
              <ChoiceGroup
                label={meal.label}
                options={INTAKE}
                columns="grid-cols-5"
                value={log.meals[meal.key] ?? null}
                onChange={(value) =>
                  update(
                    'intake',
                    (l) => ({ meals: { ...l.meals, [meal.key]: value } }),
                    value ? `${meal.label}: ${labelOf(INTAKE, value)}` : `${meal.label}: registro borrado`,
                  )
                }
                render={(o) => <span className="text-xs sm:text-sm">{o.label}</span>}
              />
            </div>
          ))}
        </div>
      </FieldGroup>

      <FieldGroup title="Hidratación del día">
        <ChoiceGroup
          label="Hidratación"
          options={HYDRATION}
          columns="grid-cols-3 sm:grid-cols-5"
          value={log.hydration}
          onChange={(value) =>
            update('intake', { hydration: value }, value ? `Hidratación: ${labelOf(HYDRATION, value)}` : 'Hidratación: borrado')
          }
          render={(o) => <span className="text-xs sm:text-sm">💧 {o.label}</span>}
        />
      </FieldGroup>

      <FieldGroup title="Deglución / disfagia">
        <ChoiceGroup
          label="Deglución"
          options={DYSPHAGIA}
          value={log.dysphagia}
          onChange={(value) =>
            update('intake', { dysphagia: value }, value ? `Deglución: ${labelOf(DYSPHAGIA, value)}` : 'Deglución: borrado')
          }
        />
      </FieldGroup>
    </SectionCard>
  );
}

/* ─────────────────── 3 · Higiene y control de esfínteres ─────────────────── */

export function HygieneSection({ log, update, lastEdit, onShowHistory }) {
  const setDiuresis = (key, options, label) => (value) =>
    update(
      'hygiene',
      (l) => ({ diuresis: { ...l.diuresis, [key]: value } }),
      value ? `Diuresis ${label}: ${labelOf(options, value)}` : `Diuresis ${label}: borrado`,
    );

  return (
    <SectionCard id="hygiene" icon={Bath} title={SECTIONS.hygiene} lastEdit={lastEdit} onShowHistory={onShowHistory}>
      <div className="grid gap-6 lg:grid-cols-2">
        <FieldGroup title="Diuresis · frecuencia">
          <ChoiceGroup label="Frecuencia" options={DIURESIS_FREQ} columns="grid-cols-2" value={log.diuresis.freq} onChange={setDiuresis('freq', DIURESIS_FREQ, 'frecuencia')} />
        </FieldGroup>
        <FieldGroup title="Diuresis · aspecto">
          <ChoiceGroup
            label="Aspecto"
            options={DIURESIS_ASPECT}
            columns="grid-cols-2"
            value={log.diuresis.aspect}
            onChange={setDiuresis('aspect', DIURESIS_ASPECT, 'aspecto')}
            render={(o) => (
              <span className="flex items-center gap-2">
                <span className={cn('size-4 rounded-full ring-1 ring-black/10', o.swatch)} aria-hidden="true" />
                {o.label}
              </span>
            )}
          />
        </FieldGroup>
      </div>

      <FieldGroup title="Deposiciones">
        <div className="grid grid-cols-2 gap-2 sm:max-w-xs">
          {[
            { value: true, label: 'Evacuó', tone: 'good' },
            { value: false, label: 'No evacuó', tone: 'warn' },
          ].map((o) => (
            <OptionButton
              key={String(o.value)}
              tone={o.tone}
              selected={log.bowel.evacuated === o.value}
              onClick={() => {
                const next = log.bowel.evacuated === o.value ? null : o.value;
                update(
                  'hygiene',
                  { bowel: { evacuated: next, bristol: next ? log.bowel.bristol : null } },
                  next === null ? 'Deposición: borrado' : `Deposición: ${o.label}`,
                );
              }}
            >
              {o.label}
            </OptionButton>
          ))}
        </div>

        {log.bowel.evacuated && (
          <div className="space-y-2 rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-500">Consistencia (escala de Bristol)</p>
            <ChoiceGroup
              label="Escala de Bristol"
              options={BRISTOL}
              columns="grid-cols-4 sm:grid-cols-7"
              value={log.bowel.bristol}
              onChange={(value, o) =>
                update(
                  'hygiene',
                  (l) => ({ bowel: { ...l.bowel, bristol: value } }),
                  value ? `Bristol tipo ${value} (${o.group.toLowerCase()})` : 'Bristol: borrado',
                )
              }
              render={(o) => (
                <span className="flex flex-col items-center leading-tight">
                  <span className="text-xl font-bold">{o.value}</span>
                  <span className="text-[10px] font-normal">{o.label}</span>
                </span>
              )}
            />
            <BristolLegend />
          </div>
        )}
      </FieldGroup>

      <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
        <FieldGroup title="Higiene realizada">
          <MultiChoice
            label="Higiene"
            options={HYGIENE}
            values={log.hygiene}
            onToggle={(value, on, o) =>
              update('hygiene', (l) => ({ hygiene: toggleIn(l.hygiene, value, on) }), `${o.label}: ${on ? 'realizado' : 'desmarcado'}`)
            }
          />
        </FieldGroup>
        <FieldGroup title="Cambios de pañal">
          <Stepper
            label="cambios de pañal"
            value={log.diapers}
            onChange={(n) => update('hygiene', { diapers: n }, `Cambios de pañal: ${n}`)}
          />
        </FieldGroup>
      </div>
    </SectionCard>
  );
}

function BristolLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
      <span>1–2 Estreñimiento</span>
      <span>3–4 Normal</span>
      <span>5 Blanda</span>
      <span>6–7 Diarrea</span>
    </div>
  );
}

/* ─────────────────── 4 · Piel, movilidad y posición ─────────────────── */

export function SkinSection({ log, update, addPosture, lastEdit, onShowHistory }) {
  const needsZone = log.skin.some((v) => SKIN.find((s) => s.value === v)?.needsZone);

  function toggleSkin(value, on, option) {
    update(
      'skin',
      (l) => {
        // "Sana" excluye al resto y viceversa
        const skin = option.exclusive ? (on ? [value] : []) : toggleIn(l.skin.filter((v) => v !== 'sana'), value, on);
        const stillNeedsZone = skin.some((v) => SKIN.find((s) => s.value === v)?.needsZone);
        return { skin, skinZones: stillNeedsZone ? l.skinZones : [] };
      },
      `Piel: ${option.label} ${on ? 'marcado' : 'desmarcado'}`,
    );
  }

  return (
    <SectionCard id="skin" icon={RotateCcw} title={SECTIONS.skin} lastEdit={lastEdit} onShowHistory={onShowHistory}>
      <FieldGroup title="Estado de la piel">
        <MultiChoice label="Estado de la piel" options={SKIN} values={log.skin} onToggle={toggleSkin} columns="grid-cols-2 sm:grid-cols-4" />
        {needsZone && (
          <div className="space-y-2 rounded-xl bg-amber-50/70 p-3 ring-1 ring-amber-200">
            <p className="text-xs font-medium text-amber-800">¿Dónde? (toca todas las zonas afectadas)</p>
            <div className="flex flex-wrap gap-2">
              {SKIN_ZONES.map((zone) => {
                const selected = log.skinZones.includes(zone);
                return (
                  <OptionButton
                    key={zone}
                    tone="warn"
                    selected={selected}
                    className="min-h-10 px-3 py-1.5"
                    onClick={() =>
                      update(
                        'skin',
                        (l) => ({ skinZones: toggleIn(l.skinZones, zone, !selected) }),
                        `Zona ${zone}: ${selected ? 'desmarcada' : 'marcada'}`,
                      )
                    }
                  >
                    {zone}
                  </OptionButton>
                );
              })}
            </div>
          </div>
        )}
      </FieldGroup>

      <FieldGroup title="Movilidad">
        <ChoiceGroup
          label="Movilidad"
          options={MOBILITY}
          value={log.mobility}
          onChange={(value) => update('skin', { mobility: value }, value ? `Movilidad: ${labelOf(MOBILITY, value)}` : 'Movilidad: borrado')}
        />
      </FieldGroup>

      <PostureLog postures={log.postures} onAdd={addPosture} highlight={log.mobility === 'postrado'} />
    </SectionCard>
  );
}

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function PostureLog({ postures, onAdd, highlight }) {
  const now = useNow();
  const last = postures[0];
  const minutesSince = last ? Math.floor((now - new Date(last.at).getTime()) / 60_000) : null;
  const overdue = minutesSince != null && minutesSince >= POSTURE_INTERVAL_MIN;
  const remaining = minutesSince != null ? POSTURE_INTERVAL_MIN - minutesSince : null;

  return (
    <FieldGroup
      title="Cambios de postura (cada 2 hrs)"
      aside={
        last && (
          <span
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
              overdue ? 'bg-red-50 text-red-700 ring-1 ring-red-200' : 'bg-accent-50 text-accent-800',
            )}
          >
            <Clock className="size-3.5" />
            {overdue ? `Atrasado ${minutesSince - POSTURE_INTERVAL_MIN} min` : `Próximo en ${formatMinutes(remaining)}`}
          </span>
        )
      }
    >
      {highlight && !last && (
        <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="size-4 shrink-0" /> Residente postrado: registra los cambios de postura.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {POSITIONS.map((p) => (
          <OptionButton key={p.value} tone="neutral" selected={last?.position === p.value} onClick={() => onAdd(p.value, `Postura: ${p.label}`)}>
            <Plus className="size-4 opacity-60" /> {p.label}
          </OptionButton>
        ))}
      </div>
      {postures.length > 0 && (
        <ol className="flex flex-wrap gap-2 text-xs">
          {postures.map((p) => (
            <li key={p.id} className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600">
              <span className="font-semibold tabular-nums text-slate-800">{formatTime(p.at)}</span> {labelOf(POSITIONS, p.position)} ·{' '}
              {shortName(p.by)}
            </li>
          ))}
        </ol>
      )}
    </FieldGroup>
  );
}

const formatMinutes = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);

/* ─────────────────── 5 · Ánimo, sueño y eventos ─────────────────── */

export function WellbeingSection({ log, update, lastEdit, onShowHistory }) {
  const [notes, setNotes] = useState(log.notes);
  useEffect(() => setNotes(log.notes), [log.notes]);

  const commitNotes = () => {
    const value = notes.trim();
    if (value !== log.notes) update('wellbeing', { notes: value }, value ? `Observación: "${value}"` : 'Observación borrada');
  };

  return (
    <SectionCard id="wellbeing" icon={Smile} title={SECTIONS.wellbeing} lastEdit={lastEdit} onShowHistory={onShowHistory}>
      <FieldGroup title="Estado de ánimo">
        <ChoiceGroup
          label="Estado de ánimo"
          options={MOODS}
          columns="grid-cols-4 sm:grid-cols-7"
          value={log.mood}
          onChange={(value, o) => update('wellbeing', { mood: value }, value ? `Ánimo: ${o.emoji} ${o.label}` : 'Ánimo: borrado')}
          render={(o) => (
            <span className="flex flex-col items-center gap-0.5 py-1 leading-tight">
              <span className="text-3xl" aria-hidden="true">
                {o.emoji}
              </span>
              <span className="text-[11px]">{o.label}</span>
            </span>
          )}
        />
      </FieldGroup>

      <div className="grid gap-6 lg:grid-cols-2">
        {SLEEP_SHIFTS.map((shift) => (
          <FieldGroup key={shift.key} title={`Sueño · ${shift.label}`}>
            <ChoiceGroup
              label={shift.label}
              options={SLEEP}
              columns="grid-cols-2"
              value={log.sleep[shift.key]}
              onChange={(value) =>
                update(
                  'wellbeing',
                  (l) => ({ sleep: { ...l.sleep, [shift.key]: value } }),
                  value ? `Sueño ${shift.label.toLowerCase()}: ${labelOf(SLEEP, value)}` : `Sueño ${shift.label.toLowerCase()}: borrado`,
                )
              }
            />
          </FieldGroup>
        ))}
      </div>

      <FieldGroup title="Eventos y alertas">
        <MultiChoice
          label="Eventos"
          options={ALERTS.map((a) => ({ ...a, tone: a.critical ? 'bad' : 'good' }))}
          values={log.alerts}
          columns="grid-cols-2 sm:grid-cols-5"
          onToggle={(value, on, o) =>
            update(
              'wellbeing',
              (l) => ({ alerts: toggleIn(l.alerts, value, on), painLevel: value === 'dolor' && !on ? null : l.painLevel }),
              `${o.label}: ${on ? 'registrado' : 'desmarcado'}`,
            )
          }
        />
        {log.alerts.includes('dolor') && <PainScale value={log.painLevel} onChange={(n) => update('wellbeing', { painLevel: n }, `Dolor: ${n}/10`)} />}
      </FieldGroup>

      <FieldGroup title="Observación (opcional)" aside={<span className="text-xs tabular-nums text-slate-400">{notes.length}/{NOTES_MAX}</span>}>
        <textarea
          rows={2}
          maxLength={NOTES_MAX}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={commitNotes}
          placeholder="Solo si es necesario. Ej: pidió hablar con su hija"
          className="w-full resize-none rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
      </FieldGroup>
    </SectionCard>
  );
}

// Verde → ámbar → rojo según intensidad
const painTone = (n) => (n <= 3 ? 'good' : n <= 6 ? 'warn' : 'bad');

function PainScale({ value, onChange }) {
  return (
    <div className="space-y-2 rounded-xl bg-red-50/60 p-3 ring-1 ring-red-100">
      <p className="text-xs font-medium text-red-800">Intensidad del dolor</p>
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <OptionButton key={n} tone={painTone(n)} selected={value === n} className="min-h-11 px-0 text-base font-bold" onClick={() => onChange(n)}>
            {n}
          </OptionButton>
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-slate-500">
        <span>Leve</span>
        <span>Insoportable</span>
      </div>
    </div>
  );
}
