-- =====================================================================
-- 014 · Rol ENCARGADA y Reportes Diarios
--
--  · user_role ENCARGADA: todo lo de una cuidadora + Reportes Diarios.
--    No ve UF, pagos, RUT, Apoderados ni Usuarios.
--  · daily_reports: resumen general del día por sede y área
--    (Kinesiología, Terapia Ocupacional, Enfermería, Encargada de turno).
--    Uno por sede, día y área. Quien lo escribe puede corregirlo ese mismo
--    día (hora de Chile); después queda cerrado salvo para ADMIN.
-- =====================================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ENCARGADA';

CREATE TABLE daily_reports (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id      SMALLINT     NOT NULL REFERENCES sites (id) ON DELETE RESTRICT,
  report_date  DATE         NOT NULL,
  area         VARCHAR(20)  NOT NULL CHECK (area IN ('KINESIOLOGIA', 'TERAPIA_OCUPACIONAL', 'ENFERMERIA', 'ENCARGADA_TURNO')),
  body         TEXT         NOT NULL CHECK (length(body) BETWEEN 1 AND 10000),
  created_by   UUID         NOT NULL REFERENCES users (id),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_by   UUID         REFERENCES users (id),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT uq_daily_reports_site_day_area UNIQUE (site_id, report_date, area)
);

CREATE INDEX idx_daily_reports_date ON daily_reports (report_date DESC, site_id);
