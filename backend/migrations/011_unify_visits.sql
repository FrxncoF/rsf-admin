-- =====================================================================
-- Visitas y reservas pasan a ser un solo módulo ("Visitas") sobre visit_bookings.
--  · relationship: parentesco de quien visita cuando no es apoderado (ej. "Nieta").
--  · Las visitas registradas en el módulo antiguo (tabla visits) se copian como
--    reservas confirmadas hechas por el equipo. La tabla visits queda sin uso
--    (se puede borrar más adelante, una vez revisado en producción).
-- =====================================================================

ALTER TABLE visit_bookings ADD COLUMN relationship VARCHAR(40);

INSERT INTO visit_bookings
  (code, site_id, resident_id, guardian_id, visit_date, start_time, end_time,
   doc_type, doc_number, visitor_name, relationship, status, source, created_by, created_at)
SELECT 'V' || upper(substr(md5(v.id::text), 1, 5)),
       v.site_id, v.resident_id, v.guardian_id,
       (v.visit_at AT TIME ZONE 'America/Santiago')::date,
       (v.visit_at AT TIME ZONE 'America/Santiago')::time,
       LEAST((v.visit_at AT TIME ZONE 'America/Santiago')::time + interval '1 hour', time '23:59'),
       'OTRO', NULL, v.visitor_name, v.relationship, 'CONFIRMED', 'STAFF', v.created_by, v.created_at
  FROM visits v
ON CONFLICT (code) DO NOTHING;
