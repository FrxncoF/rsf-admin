-- =====================================================================
-- Reservas de visitas
--  · Las hacen los familiares desde la página pública /reservar (sin login)
--    o el equipo desde el panel interno (por teléfono).
--  · Bloques horarios, cupos, hora límite y días hacia adelante se configuran
--    en Soporte (app_settings.bookings). En cada reserva se copia la hora del
--    bloque para que el historial no cambie si después se edita la configuración.
--  · Estados: BOOKED (recién hecha, sin revisar), CONFIRMED (revisada por el
--    equipo), REJECTED (rechazada por el equipo), CANCELLED (la canceló el visitante).
-- =====================================================================

CREATE TABLE visit_bookings (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 VARCHAR(8)    NOT NULL UNIQUE,
  site_id              SMALLINT      NOT NULL REFERENCES sites (id),
  -- Residente: si el visitante no es apoderado registrado se guarda lo que escribió
  -- y, si coincide con un único residente activo de la sede, también el vínculo.
  resident_id          UUID          REFERENCES residents (id),
  resident_name_input  VARCHAR(160),
  guardian_id          UUID          REFERENCES guardians (id) ON DELETE SET NULL,

  visit_date           DATE          NOT NULL,
  start_time           TIME          NOT NULL,
  end_time             TIME          NOT NULL,

  -- Datos del visitante (se anonimizan a los 12 meses si no es apoderado registrado)
  doc_type             VARCHAR(5)    NOT NULL CHECK (doc_type IN ('RUT', 'OTRO')),
  doc_number           VARCHAR(20),
  visitor_name         VARCHAR(160)  NOT NULL,
  phone                VARCHAR(16),

  status               VARCHAR(10)   NOT NULL DEFAULT 'BOOKED'
                                     CHECK (status IN ('BOOKED', 'CONFIRMED', 'REJECTED', 'CANCELLED')),
  source               VARCHAR(6)    NOT NULL CHECK (source IN ('PUBLIC', 'STAFF')),
  reject_reason        VARCHAR(200),
  reviewed_by          UUID          REFERENCES users (id),
  reviewed_at          TIMESTAMPTZ,
  cancelled_at         TIMESTAMPTZ,
  created_by           UUID          REFERENCES users (id),
  ip                   INET,
  anonymized_at        TIMESTAMPTZ,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT visit_bookings_time_order CHECK (end_time > start_time),
  CONSTRAINT visit_bookings_resident_given CHECK (resident_id IS NOT NULL OR resident_name_input IS NOT NULL)
);

CREATE INDEX idx_visit_bookings_day ON visit_bookings (visit_date, site_id, start_time);
-- Una persona no puede tener dos reservas vigentes en el mismo día y bloque
CREATE UNIQUE INDEX uq_visit_bookings_person_slot ON visit_bookings (doc_type, doc_number, visit_date, start_time)
  WHERE status IN ('BOOKED', 'CONFIRMED') AND doc_number IS NOT NULL;

INSERT INTO app_settings (key, value) VALUES
  ('bookings', '{
    "enabled": true,
    "cutoff_time": "20:00",
    "days_ahead": 7,
    "blocks": [
      {"start": "10:30", "end": "11:30", "capacity": 1, "active": true},
      {"start": "11:30", "end": "12:30", "capacity": 1, "active": true},
      {"start": "14:00", "end": "15:00", "capacity": 1, "active": true},
      {"start": "15:00", "end": "16:00", "capacity": 1, "active": true},
      {"start": "16:00", "end": "17:00", "capacity": 1, "active": true}
    ],
    "blocked_dates": []
  }')
ON CONFLICT (key) DO NOTHING;
