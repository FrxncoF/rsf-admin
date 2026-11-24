-- =====================================================================
-- 016 · Reportes Diarios: área "Turno noche"
--
--  · Reporte general de la noche (no por residente), uno por sede y noche.
--  · report_date = día en que COMIENZA la noche (lo escrito a las 02:00 del 25
--    queda como la noche del 24), igual que la ficha diaria por turno.
--  · Las cuidadoras solo ven y escriben esta área (se controla en la API).
-- =====================================================================

ALTER TABLE daily_reports DROP CONSTRAINT IF EXISTS daily_reports_area_check;
ALTER TABLE daily_reports
  ADD CONSTRAINT daily_reports_area_check
  CHECK (area IN ('KINESIOLOGIA', 'TERAPIA_OCUPACIONAL', 'ENFERMERIA', 'ENCARGADA_TURNO', 'TURNO_NOCHE'));
