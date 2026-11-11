-- =====================================================================
-- 006 · Rol SOPORTE y herramientas de soporte
--
--  · user_role SOPORTE: puede todo lo del ADMIN y además la sección Soporte.
--    Un ADMIN no ve ni administra cuentas SOPORTE.
--  · users.token_version: al incrementarlo se invalidan todas las sesiones.
--  · users.must_change_password: tras un reinicio de clave por soporte.
--  · error_logs / login_events: registro de errores 500 y de inicios de sesión.
--  · app_settings: configuración editable (aviso superior y catálogos de
--    isapres y ambulancias). residents.ambulance pasa a texto validado contra
--    el catálogo, para poder agregar opciones sin migrar.
-- =====================================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'SOPORTE';

ALTER TABLE users
  ADD COLUMN token_version        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------
-- Registro de errores del servidor
-- ---------------------------------------------------------------------
CREATE TABLE error_logs (
  id          BIGINT       PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  method      VARCHAR(10),
  path        VARCHAR(300),
  user_id     UUID,
  user_email  VARCHAR(160),
  ip          VARCHAR(64),
  message     TEXT,
  stack       TEXT
);

CREATE INDEX idx_error_logs_created ON error_logs (created_at DESC);

-- ---------------------------------------------------------------------
-- Historial de accesos
-- ---------------------------------------------------------------------
CREATE TABLE login_events (
  id          BIGINT       PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  email       VARCHAR(160),
  user_id     UUID,
  success     BOOLEAN      NOT NULL,
  reason      VARCHAR(40),   -- ok | bad_credentials | inactive | rate_limited
  ip          VARCHAR(64),
  user_agent  VARCHAR(300)
);

CREATE INDEX idx_login_events_created ON login_events (created_at DESC);
CREATE INDEX idx_login_events_email ON login_events (lower(email), created_at DESC);

-- ---------------------------------------------------------------------
-- Configuración editable
-- ---------------------------------------------------------------------
CREATE TABLE app_settings (
  key         VARCHAR(40)  PRIMARY KEY,
  value       JSONB        NOT NULL,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_by  UUID
);

INSERT INTO app_settings (key, value) VALUES
  ('banner', '{"enabled": false, "message": "", "tone": "info", "dismissible": true}'),
  ('isapres', '[
    {"value": "BANMEDICA", "label": "Banmédica", "active": true},
    {"value": "COLMENA", "label": "Colmena", "active": true},
    {"value": "CONSALUD", "label": "Consalud", "active": true},
    {"value": "CRUZ_BLANCA", "label": "Cruz Blanca", "active": true},
    {"value": "ESENCIAL", "label": "Esencial", "active": true},
    {"value": "NUEVA_MASVIDA", "label": "Nueva Masvida", "active": true},
    {"value": "VIDA_TRES", "label": "Vida Tres", "active": true},
    {"value": "FUNDACION", "label": "Fundación (BancoEstado)", "active": true},
    {"value": "ISALUD", "label": "Isalud (Codelco)", "active": true},
    {"value": "CRUZ_DEL_NORTE", "label": "Cruz del Norte", "active": true},
    {"value": "DIPRECA", "label": "Dipreca", "active": true, "standalone": true},
    {"value": "CAPREDENA", "label": "Capredena", "active": true, "standalone": true}
  ]'),
  ('ambulances', '[
    {"value": "HELP", "label": "HELP", "active": true},
    {"value": "UCORONARIA", "label": "U. Coronaria", "active": true},
    {"value": "VITALITY", "label": "Vitality", "active": true},
    {"value": "OTRA", "label": "Otra", "active": true},
    {"value": "NINGUNA", "label": "No tiene", "active": true}
  ]');

ALTER TABLE residents ALTER COLUMN ambulance TYPE VARCHAR(30) USING ambulance::text;
DROP TYPE ambulance_service;
