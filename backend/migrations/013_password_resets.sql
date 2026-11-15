-- =====================================================================
-- "Olvidé mi contraseña"
--  · Se guarda solo el hash (SHA-256) del enlace: quien lea la BD no puede usarlo.
--  · Un solo uso, vence a los 30 minutos; pedir otro invalida los anteriores.
-- =====================================================================

CREATE TABLE password_resets (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash  CHAR(64)     NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ  NOT NULL,
  used_at     TIMESTAMPTZ,
  ip          VARCHAR(64),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_password_resets_user ON password_resets (user_id, created_at DESC);
