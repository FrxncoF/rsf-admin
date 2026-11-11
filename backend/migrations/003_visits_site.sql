-- =====================================================================
-- 003 · Sede de la visita
--
-- La visita queda registrada en una sede (la del residente al momento de la
-- visita). Se guarda aparte para que el historial no cambie si el residente
-- se traslada de sede después.
-- =====================================================================

ALTER TABLE visits ADD COLUMN site_id SMALLINT REFERENCES sites (id);

UPDATE visits v SET site_id = r.site_id FROM residents r WHERE r.id = v.resident_id;

ALTER TABLE visits ALTER COLUMN site_id SET NOT NULL;

CREATE INDEX idx_visits_site ON visits (site_id, visit_at DESC);
