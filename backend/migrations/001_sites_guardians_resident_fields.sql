-- =====================================================================
-- 001 · Multi-sede, apoderados compartidos y datos administrativos del residente
--
--  · sites: sedes físicas. Cada residente pertenece a una; la misma
--    habitación/cama puede existir en ambas sedes.
--  · guardians: apoderados como entidad propia (1 apoderado → N residentes).
--  · resident_guardians pasa a ser la tabla de vínculo (residente ↔ apoderado),
--    manteniendo las reglas: mínimo 1 (trigger diferido) y máximo 2 (position 1|2).
--  · residents: fecha de ingreso, nivel de dependencia, mensualidad en UF y día de pago.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Sedes
-- ---------------------------------------------------------------------
CREATE TABLE sites (
  id          SMALLINT     PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  code        VARCHAR(30)  NOT NULL,
  name        VARCHAR(80)  NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT sites_code_key UNIQUE (code),
  CONSTRAINT sites_name_key UNIQUE (name)
);

INSERT INTO sites (code, name) VALUES
  ('los-talaveras', 'Los Talaveras'),
  ('el-curato', 'El Curato');

-- ---------------------------------------------------------------------
-- Residentes: sede + datos administrativos
-- ---------------------------------------------------------------------
CREATE TYPE dependency_level AS ENUM ('AUTOVALENTE', 'LEVE', 'MODERADA', 'SEVERA');

ALTER TABLE residents
  ADD COLUMN site_id          SMALLINT REFERENCES sites (id) ON DELETE RESTRICT,
  ADD COLUMN admission_date   DATE,
  ADD COLUMN dependency_level dependency_level,
  ADD COLUMN monthly_fee_uf   NUMERIC(7, 2),
  ADD COLUMN payment_due_day  SMALLINT;

-- Los residentes existentes quedan en la primera sede; revisarlos y corregir si corresponde.
UPDATE residents SET site_id = (SELECT id FROM sites WHERE code = 'los-talaveras');
ALTER TABLE residents ALTER COLUMN site_id SET NOT NULL;

-- Nulos permitidos solo para residentes creados antes de esta migración;
-- la API exige los cuatro campos al crear o editar.
ALTER TABLE residents
  ADD CONSTRAINT residents_admission_after_birth CHECK (admission_date IS NULL OR admission_date >= birth_date),
  ADD CONSTRAINT residents_monthly_fee_positive  CHECK (monthly_fee_uf IS NULL OR monthly_fee_uf > 0),
  ADD CONSTRAINT residents_payment_day_range     CHECK (payment_due_day IS NULL OR payment_due_day BETWEEN 1 AND 31);

-- La cama es única por sede (antes era global)
DROP INDEX uq_residents_active_bed;
CREATE UNIQUE INDEX uq_residents_active_bed
  ON residents (site_id, lower(room), lower(bed))
  WHERE is_active AND bed IS NOT NULL;

DROP INDEX idx_residents_room;
CREATE INDEX idx_residents_site_room ON residents (site_id, room, bed);

-- ---------------------------------------------------------------------
-- Apoderados como entidad propia
-- ---------------------------------------------------------------------
CREATE TABLE guardians (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name   VARCHAR(160) NOT NULL,
  rut         VARCHAR(10),                    -- opcional, normalizado 12345678-K
  phone       VARCHAR(12)  NOT NULL,          -- +56 + 9 dígitos
  email       CITEXT,
  address     VARCHAR(200),
  created_by  UUID         REFERENCES users (id) ON DELETE SET NULL,
  updated_by  UUID         REFERENCES users (id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT guardians_rut_key          UNIQUE (rut),
  CONSTRAINT guardians_rut_format       CHECK (rut IS NULL OR rut ~ '^[1-9][0-9]{5,7}-[0-9K]$'),
  CONSTRAINT guardians_name_not_blank   CHECK (btrim(full_name) <> ''),
  CONSTRAINT guardians_phone_format     CHECK (phone ~ '^\+56[0-9]{9}$'),
  CONSTRAINT guardians_email_format     CHECK (email IS NULL OR email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

CREATE INDEX idx_guardians_name_trgm ON guardians USING gin (lower(full_name) gin_trgm_ops);

CREATE TRIGGER trg_guardians_updated_at
  BEFORE UPDATE ON guardians
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- Migrar datos: cada apoderado embebido pasa a `guardians`.
-- Los que comparten RUT se unifican en un solo apoderado.
-- ---------------------------------------------------------------------
ALTER TABLE resident_guardians ADD COLUMN guardian_id UUID;

WITH by_rut AS (
  SELECT rut, gen_random_uuid() AS gid FROM resident_guardians WHERE rut IS NOT NULL GROUP BY rut
)
UPDATE resident_guardians rg SET guardian_id = by_rut.gid FROM by_rut WHERE rg.rut = by_rut.rut;

UPDATE resident_guardians SET guardian_id = gen_random_uuid() WHERE guardian_id IS NULL;

INSERT INTO guardians (id, full_name, rut, phone, email, address, created_at, updated_at)
SELECT DISTINCT ON (guardian_id) guardian_id, full_name, rut, phone, email, address, created_at, updated_at
FROM resident_guardians
ORDER BY guardian_id, updated_at DESC;

-- ---------------------------------------------------------------------
-- resident_guardians → tabla de vínculo
-- ---------------------------------------------------------------------
DROP TRIGGER trg_resident_guardians_updated_at ON resident_guardians;

ALTER TABLE resident_guardians
  DROP COLUMN id,
  DROP COLUMN full_name,
  DROP COLUMN rut,
  DROP COLUMN phone,
  DROP COLUMN email,
  DROP COLUMN address,
  DROP COLUMN updated_at;

ALTER TABLE resident_guardians
  ALTER COLUMN guardian_id SET NOT NULL,
  ADD CONSTRAINT resident_guardians_guardian_fkey
    FOREIGN KEY (guardian_id) REFERENCES guardians (id) ON DELETE RESTRICT,
  ADD CONSTRAINT resident_guardians_pkey PRIMARY KEY (resident_id, guardian_id);

CREATE INDEX idx_resident_guardians_guardian ON resident_guardians (guardian_id);

-- Se conservan: position IN (1,2), UNIQUE (resident_id, position) y los
-- constraint triggers de "al menos un apoderado" (siguen usando resident_id).
