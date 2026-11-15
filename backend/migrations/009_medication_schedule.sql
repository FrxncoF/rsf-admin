-- Horario estructurado de medicamentos (pastillero) y registro de dosis dadas.

-- 1. Horas de cada medicamento en formato 24 h, marca SOS y baja lógica
ALTER TABLE resident_medications
  ADD COLUMN times    TIME[]       NOT NULL DEFAULT '{}',
  ADD COLUMN is_sos   BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN ended_at TIMESTAMPTZ;  -- quitado de la ficha: se conserva por el historial de dosis

COMMENT ON COLUMN resident_medications.schedule IS 'Nota de horario libre (ej. "con desayuno"); las horas van en times';
COMMENT ON COLUMN resident_medications.times IS 'Horas de toma (24 h). En SOS: horas posibles';

-- Lo ya escrito como texto ("08:00 y 20:00", "8:00") pasa a horas; "SOS" marca is_sos
UPDATE resident_medications m
   SET times = sub.times
  FROM (
    SELECT id, array_agg(DISTINCT t ORDER BY t) AS times
      FROM (
        SELECT id, make_time(x[1]::int, x[2]::int, 0) AS t
          FROM resident_medications, regexp_matches(coalesce(schedule, ''), '\m([01]?\d|2[0-3]):([0-5]\d)\M', 'g') AS x
      ) parsed
     GROUP BY id
  ) sub
 WHERE sub.id = m.id;

UPDATE resident_medications SET is_sos = TRUE WHERE schedule ~* '\msos\M';

CREATE INDEX idx_resident_medications_active ON resident_medications (resident_id) WHERE ended_at IS NULL;

-- 2. Dosis registradas por las cuidadoras (Dado / Rechazó / No se dio)
CREATE TABLE medication_doses (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id  UUID          NOT NULL REFERENCES resident_medications (id) ON DELETE CASCADE,
  resident_id    UUID          NOT NULL REFERENCES residents (id),
  dose_date      DATE          NOT NULL,
  dose_time      TIME          NOT NULL,   -- hora programada (en SOS: hora en que se dio)
  status         VARCHAR(12)   NOT NULL,
  note           VARCHAR(200),
  recorded_by    UUID          NOT NULL REFERENCES users (id),
  recorded_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT medication_doses_status_check CHECK (status IN ('GIVEN', 'REFUSED', 'NOT_GIVEN')),
  CONSTRAINT uq_medication_doses_slot UNIQUE (medication_id, dose_date, dose_time)
);

CREATE INDEX idx_medication_doses_date ON medication_doses (dose_date, resident_id);
