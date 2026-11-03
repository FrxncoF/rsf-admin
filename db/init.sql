-- =====================================================================
-- Residencia San Francisco · Fase 1 · Esquema inicial (PostgreSQL 15+)
-- Se ejecuta automáticamente la PRIMERA vez que se crea el volumen de datos
-- (docker-entrypoint-initdb.d). Es idempotente para poder re-aplicarlo a mano.
-- =====================================================================

SET client_encoding = 'UTF8';
SET timezone = 'America/Santiago';

CREATE EXTENSION IF NOT EXISTS citext;   -- emails case-insensitive
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- búsqueda parcial por nombre

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
DO $$
BEGIN
  CREATE TYPE user_role AS ENUM ('ADMIN', 'CUIDADORA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------
-- Trigger genérico para updated_at
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------
-- users: personal con acceso al sistema
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email          CITEXT       NOT NULL,
  password_hash  TEXT         NOT NULL,
  full_name      VARCHAR(120) NOT NULL,
  role           user_role    NOT NULL DEFAULT 'CUIDADORA',
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT users_email_key           UNIQUE (email),
  CONSTRAINT users_email_format        CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT users_full_name_not_blank CHECK (btrim(full_name) <> '')
);

CREATE INDEX IF NOT EXISTS idx_users_role_active ON users (role, is_active);

CREATE OR REPLACE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- residents: adultos mayores de la residencia
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS residents (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name  VARCHAR(80)  NOT NULL,
  last_name   VARCHAR(120) NOT NULL,
  rut         VARCHAR(10)  NOT NULL,          -- normalizado: 12345678-K (sin puntos)
  birth_date  DATE         NOT NULL,
  room        VARCHAR(20)  NOT NULL,          -- habitación
  bed         VARCHAR(10),                    -- cama (opcional)
  photo_path  TEXT,                           -- nombre de archivo en el volumen de uploads
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_by  UUID         REFERENCES users (id) ON DELETE SET NULL,
  updated_by  UUID         REFERENCES users (id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT residents_rut_key           UNIQUE (rut),
  CONSTRAINT residents_rut_format        CHECK (rut ~ '^[1-9][0-9]{5,7}-[0-9K]$'),
  CONSTRAINT residents_birth_date_range  CHECK (birth_date >= DATE '1900-01-01'),
  CONSTRAINT residents_names_not_blank   CHECK (btrim(first_name) <> '' AND btrim(last_name) <> ''),
  CONSTRAINT residents_room_not_blank    CHECK (btrim(room) <> '')
);

-- Una cama no puede estar asignada a dos residentes activos a la vez
CREATE UNIQUE INDEX IF NOT EXISTS uq_residents_active_bed
  ON residents (lower(room), lower(bed))
  WHERE is_active AND bed IS NOT NULL;

-- Listados por estado ordenados por apellido
CREATE INDEX IF NOT EXISTS idx_residents_active_name
  ON residents (is_active, last_name, first_name);

CREATE INDEX IF NOT EXISTS idx_residents_room
  ON residents (room, bed);

-- Búsqueda parcial por nombre completo (LIKE '%texto%')
CREATE INDEX IF NOT EXISTS idx_residents_fullname_trgm
  ON residents USING gin (lower(first_name || ' ' || last_name) gin_trgm_ops);

CREATE OR REPLACE TRIGGER trg_residents_updated_at
  BEFORE UPDATE ON residents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- resident_guardians: apoderados del residente (mínimo 1, máximo 2)
--   · máximo 2  → position solo puede ser 1 o 2 y es única por residente
--   · mínimo 1  → constraint trigger diferido (se valida al hacer COMMIT,
--                 así se puede insertar el residente y luego sus apoderados)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resident_guardians (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id   UUID         NOT NULL REFERENCES residents (id) ON DELETE CASCADE,
  position      SMALLINT     NOT NULL,          -- 1 = principal, 2 = secundario
  full_name     VARCHAR(160) NOT NULL,
  rut           VARCHAR(10),                    -- opcional, normalizado 12345678-K
  relationship  VARCHAR(40)  NOT NULL,          -- parentesco (hija, sobrino, ...)
  phone         VARCHAR(12)  NOT NULL,          -- Chile: +56 + 9 dígitos (+56912345678)
  email         CITEXT,
  address       VARCHAR(200),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT resident_guardians_position_check  CHECK (position IN (1, 2)),
  CONSTRAINT resident_guardians_position_key    UNIQUE (resident_id, position),
  CONSTRAINT resident_guardians_rut_key         UNIQUE (resident_id, rut),
  CONSTRAINT resident_guardians_rut_format      CHECK (rut IS NULL OR rut ~ '^[1-9][0-9]{5,7}-[0-9K]$'),
  CONSTRAINT resident_guardians_name_not_blank  CHECK (btrim(full_name) <> ''),
  CONSTRAINT resident_guardians_phone_format    CHECK (phone ~ '^\+56[0-9]{9}$'),
  CONSTRAINT resident_guardians_email_format    CHECK (email IS NULL OR email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

CREATE INDEX IF NOT EXISTS idx_resident_guardians_resident ON resident_guardians (resident_id, position);

-- Bases creadas antes del formato fijo +56: se actualiza la columna y su restricción
ALTER TABLE resident_guardians DROP CONSTRAINT IF EXISTS resident_guardians_phone_format;
ALTER TABLE resident_guardians ALTER COLUMN phone TYPE VARCHAR(12);
ALTER TABLE resident_guardians
  ADD CONSTRAINT resident_guardians_phone_format CHECK (phone ~ '^\+56[0-9]{9}$');

CREATE OR REPLACE TRIGGER trg_resident_guardians_updated_at
  BEFORE UPDATE ON resident_guardians
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION check_resident_has_guardian() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  rid UUID;
BEGIN
  -- IF y no CASE: PL/pgSQL valida los campos de ambas ramas de un CASE
  IF TG_TABLE_NAME = 'residents' THEN
    rid := NEW.id;
  ELSE
    rid := OLD.resident_id;
  END IF;

  IF EXISTS (SELECT 1 FROM residents WHERE id = rid)
     AND NOT EXISTS (SELECT 1 FROM resident_guardians WHERE resident_id = rid) THEN
    RAISE EXCEPTION 'El residente % debe tener al menos un apoderado', rid
      USING ERRCODE = '23514', CONSTRAINT = 'residents_guardian_required';
  END IF;
  RETURN NULL;
END $$;

-- Los constraint triggers no admiten OR REPLACE
DROP TRIGGER IF EXISTS trg_residents_guardian_required ON residents;
CREATE CONSTRAINT TRIGGER trg_residents_guardian_required
  AFTER INSERT ON residents
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_resident_has_guardian();

DROP TRIGGER IF EXISTS trg_guardians_keep_one ON resident_guardians;
CREATE CONSTRAINT TRIGGER trg_guardians_keep_one
  AFTER DELETE OR UPDATE OF resident_id ON resident_guardians
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_resident_has_guardian();

-- El usuario ADMIN inicial lo crea el backend al arrancar
-- (variables ADMIN_EMAIL / ADMIN_PASSWORD), así no hay credenciales en este archivo.
