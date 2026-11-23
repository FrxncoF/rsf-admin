-- =====================================================================
-- 015 · Usuarios conectados (Soporte → Estado)
--
--  · Una fila por usuario con la hora de su última actividad. Se SOBRESCRIBE
--    (como máximo una vez por minuto), así que no crece con el tiempo.
--  · Tabla aparte de users para no disparar su trigger de updated_at.
-- =====================================================================

CREATE TABLE user_presence (
  user_id       UUID         PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  last_seen_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
