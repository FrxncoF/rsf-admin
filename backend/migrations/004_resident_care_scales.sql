-- =====================================================================
-- 004 · Cobertura y escalas de valoración del residente
--
--  · Ambulancia: reemplaza el booleano has_help por el servicio contratado
--    (HELP, U. Coronaria, Vitality, otra o ninguna).
--  · CESFAM (inscrito sí/no) y lugar de atención (texto libre).
--  · Índice de Pfeiffer (estado cognitivo) y escala de Norton (riesgo de
--    úlceras por presión). El índice de Katz es el dependency_level existente.
--  · La previsión admite Dipreca y Capredena dentro de la lista de isapres
--    (se valida en la aplicación; no requiere cambios de esquema).
-- =====================================================================

CREATE TYPE ambulance_service AS ENUM ('HELP', 'UCORONARIA', 'VITALITY', 'OTRA', 'NINGUNA');
CREATE TYPE cognitive_level AS ENUM ('INTACTA', 'LEVE', 'MODERADO', 'SEVERO');
CREATE TYPE pressure_risk AS ENUM ('MINIMO', 'MEDIO', 'ALTO', 'MUY_ALTO');

ALTER TABLE residents
  ADD COLUMN ambulance       ambulance_service,
  ADD COLUMN has_cesfam      BOOLEAN,
  ADD COLUMN care_place      VARCHAR(120),
  ADD COLUMN cognitive_level cognitive_level,
  ADD COLUMN pressure_risk   pressure_risk;

UPDATE residents SET ambulance = CASE WHEN has_help THEN 'HELP' ELSE 'NINGUNA' END::ambulance_service
 WHERE has_help IS NOT NULL;

ALTER TABLE residents DROP COLUMN has_help;
