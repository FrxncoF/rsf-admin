-- =====================================================================
-- 007 · Teléfono del apoderado opcional en la BD
--
-- Para importar planillas donde falta el celular: el registro queda sin
-- teléfono y la ficha del residente avisa "Faltan datos". El formulario lo
-- sigue exigiendo, así que al editar el apoderado se debe completar.
-- =====================================================================

ALTER TABLE guardians ALTER COLUMN phone DROP NOT NULL;
