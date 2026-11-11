import { AlertTriangle, Bath, HeartPulse, Plus, RotateCcw, Smile, Utensils, X } from 'lucide-react';
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
  SECTIONS,
  SKIN,
  SKIN_ZONES,
  SLEEP,
  SLEEP_SHIFTS,
  VITALS,
  labelOf,
} from './options';
import { ChoiceGroup, FieldGroup, FormSection, MultiChoice, OptionButton, Stepper } from './controls';
import { formatTime, vitalStatus } from './form';

// Cada sección recibe la ficha (`log`) y `set(patch | (log) => patch)`.

const toggleIn = (list, value, on) => (on ? [...list, value] : list.filter((v) => v !== value));

/* ───────────────────────── 1 · Signos vitales ───────────────────────── */

export function VitalsSection({ log, set }) {
  const setValue = (def) => (e) => {
    const clean = e.target.value.replace(',', '.').replace(def.decimal ? /[^\d.]/g : /\D/g, '');
    set((l) => ({ vitals: { ...l.vitals, [def.key]: clean.slice(0, def.decimal ? 4 : 3) } }));
  };

  return (
    <FormSection id="vitals" icon={HeartPulse} title={SECTIONS.vitals}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {VITALS.map((def) => {
          const status = vitalStatus(def, log.vitals[def.key]);
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
                  value={log.vitals[def.key]}
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
    </FormSection>
  );
}

/* ─────────────────── 2 · Alimentación e hidratación ─────────────────── */

export function IntakeSection({ log, set }) {
  return (
    <FormSection id="intake" icon={Utensils} title={SECTIONS.intake}>
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
                onChange={(value) => set((l) => ({ meals: { ...l.meals, [meal.key]: value } }))}
                render={(o) => <span className="text-xs sm:text-sm">{o.label}</span>}
              />
            </div>
          ))}
        </div>
      </FieldGroup>

      <FieldGroup title="Hidratación">
        <ChoiceGroup
          label="Hidratación"
          options={HYDRATION}
          columns="grid-cols-3 sm:grid-cols-5"
          value={log.hydration}
          onChange={(value) => set({ hydration: value })}
          render={(o) => <span className="text-xs sm:text-sm">💧 {o.label}</span>}
        />
      </FieldGroup>

      <FieldGroup title="Deglución / disfagia">
        <ChoiceGroup label="Deglución" options={DYSPHAGIA} value={log.dysphagia} onChange={(value) => set({ dysphagia: value })} />
      </FieldGroup>
    </FormSection>
  );
}

/* ─────────────────── 3 · Higiene y control de esfínteres ─────────────────── */

export function HygieneSection({ log, set }) {
  const setDiuresis = (key) => (value) => set((l) => ({ diuresis: { ...l.diuresis, [key]: value } }));

  return (
    <FormSection id="hygiene" icon={Bath} title={SECTIONS.hygiene}>
      <div className="grid gap-6 lg:grid-cols-2">
        <FieldGroup title="Diuresis · frecuencia">
          <ChoiceGroup label="Frecuencia" options={DIURESIS_FREQ} columns="grid-cols-2" value={log.diuresis.freq} onChange={setDiuresis('freq')} />
        </FieldGroup>
        <FieldGroup title="Diuresis · aspecto">
          <ChoiceGroup
            label="Aspecto"
            options={DIURESIS_ASPECT}
            columns="grid-cols-2"
            value={log.diuresis.aspect}
            onChange={setDiuresis('aspect')}
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
              onClick={() =>
                set((l) => {
                  const next = l.bowel.evacuated === o.value ? null : o.value;
                  return { bowel: { evacuated: next, bristol: next ? l.bowel.bristol : null } };
                })
              }
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
              onChange={(value) => set((l) => ({ bowel: { ...l.bowel, bristol: value } }))}
              render={(o) => (
                <span className="flex flex-col items-center leading-tight">
                  <span className="text-xl font-bold">{o.value}</span>
                  <span className="text-[10px] font-normal">{o.label}</span>
                </span>
              )}
            />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
              <span>1–2 Estreñimiento</span>
              <span>3–4 Normal</span>
              <span>5 Blanda</span>
              <span>6–7 Diarrea</span>
            </div>
          </div>
        )}
      </FieldGroup>

      <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
        <FieldGroup title="Higiene realizada">
          <MultiChoice
            label="Higiene"
            options={HYGIENE}
            values={log.hygiene}
            onToggle={(value, on) => set((l) => ({ hygiene: toggleIn(l.hygiene, value, on) }))}
          />
        </FieldGroup>
        <FieldGroup title="Cambios de pañal">
          <Stepper label="cambios de pañal" value={log.diapers} onChange={(n) => set({ diapers: n })} />
        </FieldGroup>
      </div>
    </FormSection>
  );
}

/* ─────────────────── 4 · Piel, movilidad y posición ─────────────────── */

export function SkinSection({ log, set }) {
  const needsZone = log.skin.some((v) => SKIN.find((s) => s.value === v)?.needsZone);

  const toggleSkin = (value, on, option) =>
    set((l) => {
      // "Sana" excluye al resto y viceversa
      const skin = option.exclusive ? (on ? [value] : []) : toggleIn(l.skin.filter((v) => v !== 'sana'), value, on);
      const stillNeedsZone = skin.some((v) => SKIN.find((s) => s.value === v)?.needsZone);
      return { skin, skinZones: stillNeedsZone ? l.skinZones : [] };
    });

  return (
    <FormSection id="skin" icon={RotateCcw} title={SECTIONS.skin}>
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
                    onClick={() => set((l) => ({ skinZones: toggleIn(l.skinZones, zone, !selected) }))}
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
        <ChoiceGroup label="Movilidad" options={MOBILITY} value={log.mobility} onChange={(value) => set({ mobility: value })} />
      </FieldGroup>

      <FieldGroup title="Cambios de postura">
        {log.mobility === 'postrado' && log.postures.length === 0 && (
          <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="size-4 shrink-0" /> Residente postrado: registra los cambios de postura.
          </p>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {POSITIONS.map((p) => (
            <OptionButton
              key={p.value}
              tone="neutral"
              selected={log.postures.at(-1)?.position === p.value}
              onClick={() => set((l) => ({ postures: [...l.postures, { at: new Date().toISOString(), position: p.value }] }))}
            >
              <Plus className="size-4 opacity-60" /> {p.label}
            </OptionButton>
          ))}
        </div>
        {log.postures.length > 0 && (
          <ol className="flex flex-wrap gap-2 text-xs">
            {log.postures.map((p, i) => (
              <li key={p.at} className="flex items-center gap-1 rounded-lg bg-slate-100 py-1 pl-2.5 pr-1 text-slate-600">
                <span className="font-semibold tabular-nums text-slate-800">{formatTime(p.at)}</span> {labelOf(POSITIONS, p.position)}
                <button
                  type="button"
                  aria-label="Quitar"
                  onClick={() => set((l) => ({ postures: l.postures.filter((_, j) => j !== i) }))}
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ol>
        )}
      </FieldGroup>
    </FormSection>
  );
}

/* ─────────────────── 5 · Ánimo, sueño y eventos ─────────────────── */

export function WellbeingSection({ log, set }) {
  return (
    <FormSection id="wellbeing" icon={Smile} title={SECTIONS.wellbeing}>
      <FieldGroup title="Estado de ánimo">
        <ChoiceGroup
          label="Estado de ánimo"
          options={MOODS}
          columns="grid-cols-4 sm:grid-cols-7"
          value={log.mood}
          onChange={(value) => set({ mood: value })}
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
              onChange={(value) => set((l) => ({ sleep: { ...l.sleep, [shift.key]: value } }))}
            />
          </FieldGroup>
        ))}
      </div>

      <FieldGroup title="Eventos y alertas">
        <MultiChoice
          label="Eventos"
          options={ALERTS.map((a) => ({ ...a, tone: 'bad' }))}
          values={log.alerts}
          columns="grid-cols-2 sm:grid-cols-4"
          onToggle={(value, on) =>
            set((l) => ({ alerts: toggleIn(l.alerts, value, on), painLevel: value === 'dolor' && !on ? null : l.painLevel }))
          }
        />
        {log.alerts.includes('dolor') && <PainScale value={log.painLevel} onChange={(n) => set({ painLevel: n })} />}
      </FieldGroup>

      <FieldGroup title="Observación (opcional)" aside={<span className="text-xs tabular-nums text-slate-400">{log.notes.length}/{NOTES_MAX}</span>}>
        <textarea
          rows={2}
          maxLength={NOTES_MAX}
          value={log.notes}
          onChange={(e) => set({ notes: e.target.value })}
          placeholder="Solo si es necesario. Ej: pidió hablar con su hija"
          className="w-full resize-none rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
      </FieldGroup>
    </FormSection>
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
          <OptionButton
            key={n}
            tone={painTone(n)}
            selected={value === n}
            className="min-h-11 px-0 text-base font-bold"
            onClick={() => onChange(value === n ? null : n)}
          >
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
