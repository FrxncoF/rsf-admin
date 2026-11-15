-- =====================================================================
-- Ficha diaria por turno
--  · Una ficha por residente y turno (DIA / NOCHE). Se va completando durante
--    el turno (guardado parcial) y se cierra sola cuando termina el turno.
--  · shift_date = día en que COMIENZA el turno (la noche del 15 va de 15 20:00 a 16 08:00).
--  · Horarios de turno configurables en Soporte (app_settings.shifts).
--  · Cada cambio queda en daily_log_changes (quién, cuándo, valor anterior y nuevo).
--  · Las fichas anteriores a este cambio quedan como "legacy": cerradas, tal cual.
-- =====================================================================

ALTER TABLE daily_logs
  ADD COLUMN shift_date DATE,
  ADD COLUMN shift      VARCHAR(5) CHECK (shift IN ('DIA', 'NOCHE')),
  ADD COLUMN legacy     BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN updated_by UUID REFERENCES users (id);

-- Fichas existentes: se ubican en su turno (08:00–20:00 día; resto noche) y quedan cerradas
UPDATE daily_logs l
   SET legacy = TRUE,
       updated_at = l.created_at,
       updated_by = l.created_by,
       shift = CASE WHEN (l.created_at AT TIME ZONE 'America/Santiago')::time >= '08:00'
                     AND (l.created_at AT TIME ZONE 'America/Santiago')::time < '20:00' THEN 'DIA' ELSE 'NOCHE' END,
       shift_date = CASE WHEN (l.created_at AT TIME ZONE 'America/Santiago')::time < '08:00'
                         THEN (l.created_at AT TIME ZONE 'America/Santiago')::date - 1
                         ELSE (l.created_at AT TIME ZONE 'America/Santiago')::date END;

ALTER TABLE daily_logs
  ALTER COLUMN shift_date SET NOT NULL,
  ALTER COLUMN shift SET NOT NULL;

-- Una sola ficha por residente y turno (las antiguas pueden repetirse)
CREATE UNIQUE INDEX uq_daily_logs_resident_shift ON daily_logs (resident_id, shift_date, shift) WHERE NOT legacy;
CREATE INDEX idx_daily_logs_resident_shift ON daily_logs (resident_id, shift_date DESC);

CREATE TABLE daily_log_changes (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id  UUID         NOT NULL REFERENCES daily_logs (id) ON DELETE CASCADE,
  -- { "vitals.pa_s": [180, 120], "meals.almuerzo": [null, "75"] }
  changes       JSONB        NOT NULL CHECK (jsonb_typeof(changes) = 'object'),
  changed_by    UUID         NOT NULL REFERENCES users (id),
  changed_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_daily_log_changes_log ON daily_log_changes (daily_log_id, changed_at);

INSERT INTO app_settings (key, value) VALUES
  ('shifts', '{"day_start": "08:00", "night_start": "20:00"}')
ON CONFLICT (key) DO NOTHING;
