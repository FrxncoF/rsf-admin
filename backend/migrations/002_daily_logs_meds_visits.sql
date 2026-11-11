-- =====================================================================
-- 002 · Fichas diarias, patologías, medicamentos, visitas y previsión
--
--  · residents: HELP (seguro de ambulancia) y previsión de salud (Fonasa / Isapre).
--  · resident_conditions / resident_medications: datos clínicos (edita ADMIN).
--  · daily_logs: cada ficha diaria es una fila con todo su contenido en `data`
--    (JSONB). Puede haber varias por día y no se modifican una vez guardadas:
--    las correcciones se agregan como notas (daily_log_notes).
--  · visits: registro de visitas al residente (apoderado u otra persona).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Residentes: HELP y previsión
-- ---------------------------------------------------------------------
CREATE TYPE health_system AS ENUM ('FONASA', 'ISAPRE');

ALTER TABLE residents
  ADD COLUMN has_help      BOOLEAN,
  ADD COLUMN health_system health_system,
  ADD COLUMN isapre        VARCHAR(30),
  -- La isapre se indica solo (y siempre) cuando la previsión es ISAPRE
  ADD CONSTRAINT residents_isapre_matches_system
    CHECK ((health_system = 'ISAPRE') = (isapre IS NOT NULL));

-- ---------------------------------------------------------------------
-- Patologías
-- ---------------------------------------------------------------------
CREATE TABLE resident_conditions (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id  UUID          NOT NULL REFERENCES residents (id) ON DELETE CASCADE,
  name         VARCHAR(120)  NOT NULL,
  created_by   UUID          REFERENCES users (id),
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT resident_conditions_name_not_blank CHECK (btrim(name) <> '')
);

CREATE UNIQUE INDEX uq_resident_conditions_name ON resident_conditions (resident_id, lower(name));

-- ---------------------------------------------------------------------
-- Medicamentos
-- ---------------------------------------------------------------------
CREATE TABLE resident_medications (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id   UUID          NOT NULL REFERENCES residents (id) ON DELETE CASCADE,
  name          VARCHAR(120)  NOT NULL,
  dose          VARCHAR(60)   NOT NULL,   -- "50 mg", "1 comprimido de 500 mg", "10 gotas"
  schedule      VARCHAR(80),              -- "Cada 12 h", "08:00 y 20:00", "SOS"
  instructions  VARCHAR(200),             -- "Con comida", "Si hay dolor"
  created_by    UUID          REFERENCES users (id),
  updated_by    UUID          REFERENCES users (id),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT resident_medications_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT resident_medications_dose_not_blank CHECK (btrim(dose) <> '')
);

CREATE INDEX idx_resident_medications_resident ON resident_medications (resident_id);

CREATE TRIGGER trg_resident_medications_updated_at
  BEFORE UPDATE ON resident_medications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- Fichas diarias (inmutables)
-- ---------------------------------------------------------------------
CREATE TABLE daily_logs (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id  UUID         NOT NULL REFERENCES residents (id) ON DELETE CASCADE,
  data         JSONB        NOT NULL,
  created_by   UUID         NOT NULL REFERENCES users (id),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT daily_logs_data_is_object CHECK (jsonb_typeof(data) = 'object')
);

CREATE INDEX idx_daily_logs_resident_created ON daily_logs (resident_id, created_at DESC);

CREATE TABLE daily_log_notes (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id  UUID          NOT NULL REFERENCES daily_logs (id) ON DELETE CASCADE,
  body          VARCHAR(300)  NOT NULL,
  created_by    UUID          NOT NULL REFERENCES users (id),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT daily_log_notes_body_not_blank CHECK (btrim(body) <> '')
);

CREATE INDEX idx_daily_log_notes_log ON daily_log_notes (daily_log_id, created_at);

-- ---------------------------------------------------------------------
-- Visitas
-- ---------------------------------------------------------------------
CREATE TABLE visits (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id   UUID          NOT NULL REFERENCES residents (id) ON DELETE CASCADE,
  -- Si vino un apoderado se enlaza; el nombre y parentesco se copian para que el
  -- historial no cambie si después se edita o elimina el apoderado.
  guardian_id   UUID          REFERENCES guardians (id) ON DELETE SET NULL,
  visitor_name  VARCHAR(120)  NOT NULL,
  relationship  VARCHAR(40),
  visit_at      TIMESTAMPTZ   NOT NULL,
  created_by    UUID          NOT NULL REFERENCES users (id),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT visits_visitor_not_blank CHECK (btrim(visitor_name) <> '')
);

CREATE INDEX idx_visits_visit_at ON visits (visit_at DESC);
CREATE INDEX idx_visits_resident ON visits (resident_id, visit_at DESC);
