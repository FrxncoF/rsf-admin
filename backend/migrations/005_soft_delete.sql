-- =====================================================================
-- 005 · Sin borrado físico de residentes, apoderados ni usuarios
--
-- Se desactivan (is_active = FALSE) en vez de eliminarse, para conservar el
-- historial (fichas, visitas, auditoría). Residentes y usuarios ya tenían
-- is_active; se agrega a apoderados. Un trigger impide el DELETE en las tres
-- tablas como resguardo ante errores o consultas manuales.
-- =====================================================================

ALTER TABLE guardians ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX idx_guardians_active ON guardians (is_active, full_name);

CREATE OR REPLACE FUNCTION prevent_hard_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'No se permite eliminar registros de %: desactívalos (is_active = FALSE)', TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER trg_residents_no_delete BEFORE DELETE ON residents
  FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();

CREATE TRIGGER trg_guardians_no_delete BEFORE DELETE ON guardians
  FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();

CREATE TRIGGER trg_users_no_delete BEFORE DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
