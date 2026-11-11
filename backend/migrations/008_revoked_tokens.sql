-- Sesiones cerradas con "Salir": el token deja de valer aunque no haya expirado.
-- Se guarda solo el identificador (jti) hasta su vencimiento; luego se limpia.
CREATE TABLE revoked_tokens (
  jti         UUID         PRIMARY KEY,
  expires_at  TIMESTAMPTZ  NOT NULL
);

CREATE INDEX idx_revoked_tokens_expires ON revoked_tokens (expires_at);
