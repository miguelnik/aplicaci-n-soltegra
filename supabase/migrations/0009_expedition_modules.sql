-- ============================================================================
-- Migración 0009: Módulos de gestión de proyecto y dirección de obra
-- Tablas: milestones, decisions, incidents, risks, site_visits,
--         meeting_minutes, budget, cost_items, photos
-- ============================================================================

-- ── 1. HITOS (expedition_milestones) ─────────────────────────────────────────

CREATE TABLE expedition_milestones (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id            UUID NOT NULL REFERENCES certificate_requests(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  description           TEXT,
  due_date              DATE,
  completed_at          TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','in_progress','completed','delayed')),
  is_visible_to_client  BOOLEAN NOT NULL DEFAULT true,
  "order"               INT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE expedition_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access - milestones"
  ON expedition_milestones FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Client reads own visible milestones"
  ON expedition_milestones FOR SELECT
  TO authenticated
  USING (
    is_visible_to_client = true
    AND EXISTS (
      SELECT 1 FROM certificate_requests cr
      JOIN profiles p ON p.organization_id = cr.organization_id
      WHERE cr.id = expedition_milestones.request_id
        AND p.id = auth.uid()
    )
  );

-- ── 2. DECISIONES (expedition_decisions) ─────────────────────────────────────

CREATE TABLE expedition_decisions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id            UUID NOT NULL REFERENCES certificate_requests(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  description           TEXT,
  deadline              DATE,
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','rejected','deferred')),
  client_response       TEXT,
  client_responded_at   TIMESTAMPTZ,
  is_visible_to_client  BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE expedition_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access - decisions"
  ON expedition_decisions FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Client reads own visible decisions"
  ON expedition_decisions FOR SELECT
  TO authenticated
  USING (
    is_visible_to_client = true
    AND EXISTS (
      SELECT 1 FROM certificate_requests cr
      JOIN profiles p ON p.organization_id = cr.organization_id
      WHERE cr.id = expedition_decisions.request_id
        AND p.id = auth.uid()
    )
  );

CREATE POLICY "Client responds to own decisions"
  ON expedition_decisions FOR UPDATE
  TO authenticated
  USING (
    is_visible_to_client = true
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM certificate_requests cr
      JOIN profiles p ON p.organization_id = cr.organization_id
      WHERE cr.id = expedition_decisions.request_id
        AND p.id = auth.uid()
    )
  )
  WITH CHECK (true);

-- ── 3. INCIDENCIAS (expedition_incidents) ─────────────────────────────────────

CREATE TABLE expedition_incidents (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id            UUID NOT NULL REFERENCES certificate_requests(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  description           TEXT,
  severity              TEXT NOT NULL DEFAULT 'medium'
                        CHECK (severity IN ('low','medium','high','critical')),
  status                TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','in_progress','resolved','closed')),
  is_visible_to_client  BOOLEAN NOT NULL DEFAULT false,
  resolved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE expedition_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access - incidents"
  ON expedition_incidents FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Client reads own visible incidents"
  ON expedition_incidents FOR SELECT
  TO authenticated
  USING (
    is_visible_to_client = true
    AND EXISTS (
      SELECT 1 FROM certificate_requests cr
      JOIN profiles p ON p.organization_id = cr.organization_id
      WHERE cr.id = expedition_incidents.request_id
        AND p.id = auth.uid()
    )
  );

-- ── 4. RIESGOS (expedition_risks) ────────────────────────────────────────────

CREATE TABLE expedition_risks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id            UUID NOT NULL REFERENCES certificate_requests(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  description           TEXT,
  probability           TEXT NOT NULL DEFAULT 'medium'
                        CHECK (probability IN ('low','medium','high')),
  impact                TEXT NOT NULL DEFAULT 'medium'
                        CHECK (impact IN ('low','medium','high')),
  status                TEXT NOT NULL DEFAULT 'identified'
                        CHECK (status IN ('identified','mitigated','accepted','closed')),
  mitigation            TEXT,
  is_visible_to_client  BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE expedition_risks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access - risks"
  ON expedition_risks FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Client reads own visible risks"
  ON expedition_risks FOR SELECT
  TO authenticated
  USING (
    is_visible_to_client = true
    AND EXISTS (
      SELECT 1 FROM certificate_requests cr
      JOIN profiles p ON p.organization_id = cr.organization_id
      WHERE cr.id = expedition_risks.request_id
        AND p.id = auth.uid()
    )
  );

-- ── 5. VISITAS DE OBRA (expedition_site_visits) ───────────────────────────────

CREATE TABLE expedition_site_visits (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id            UUID NOT NULL REFERENCES certificate_requests(id) ON DELETE CASCADE,
  visited_at            DATE NOT NULL,
  technician            TEXT NOT NULL,
  observations          TEXT,
  is_visible_to_client  BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE expedition_site_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access - site_visits"
  ON expedition_site_visits FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Client reads own visible site visits"
  ON expedition_site_visits FOR SELECT
  TO authenticated
  USING (
    is_visible_to_client = true
    AND EXISTS (
      SELECT 1 FROM certificate_requests cr
      JOIN profiles p ON p.organization_id = cr.organization_id
      WHERE cr.id = expedition_site_visits.request_id
        AND p.id = auth.uid()
    )
  );

-- ── 6. ACTAS (expedition_meeting_minutes) ────────────────────────────────────

CREATE TABLE expedition_meeting_minutes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id            UUID NOT NULL REFERENCES certificate_requests(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  meeting_date          DATE NOT NULL,
  attendees             TEXT[],
  summary               TEXT,
  action_points         TEXT[],
  storage_path          TEXT,
  original_filename     TEXT,
  mime_type             TEXT,
  size_bytes            BIGINT,
  is_visible_to_client  BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE expedition_meeting_minutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access - meeting_minutes"
  ON expedition_meeting_minutes FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Client reads own visible meeting minutes"
  ON expedition_meeting_minutes FOR SELECT
  TO authenticated
  USING (
    is_visible_to_client = true
    AND EXISTS (
      SELECT 1 FROM certificate_requests cr
      JOIN profiles p ON p.organization_id = cr.organization_id
      WHERE cr.id = expedition_meeting_minutes.request_id
        AND p.id = auth.uid()
    )
  );

-- ── 7. PRESUPUESTO BASE (expedition_budget) ───────────────────────────────────

CREATE TABLE expedition_budget (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID NOT NULL UNIQUE REFERENCES certificate_requests(id) ON DELETE CASCADE,
  initial_budget  NUMERIC(12,2),
  currency        TEXT NOT NULL DEFAULT 'EUR',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE expedition_budget ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access - budget"
  ON expedition_budget FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ── 8. PARTIDAS DE COSTE (expedition_cost_items) ─────────────────────────────

CREATE TABLE expedition_cost_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID NOT NULL REFERENCES certificate_requests(id) ON DELETE CASCADE,
  budget_id       UUID REFERENCES expedition_budget(id) ON DELETE SET NULL,
  description     TEXT NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  category        TEXT NOT NULL DEFAULT 'other'
                  CHECK (category IN ('labor','materials','equipment','subcontract','other')),
  is_approved     BOOLEAN NOT NULL DEFAULT false,
  date            DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE expedition_cost_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access - cost_items"
  ON expedition_cost_items FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ── 9. FOTOS DE OBRA (expedition_photos) ─────────────────────────────────────

CREATE TABLE expedition_photos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id            UUID NOT NULL REFERENCES certificate_requests(id) ON DELETE CASCADE,
  storage_path          TEXT NOT NULL,
  original_filename     TEXT NOT NULL,
  mime_type             TEXT,
  size_bytes            BIGINT,
  caption               TEXT,
  taken_at              DATE,
  is_visible_to_client  BOOLEAN NOT NULL DEFAULT true,
  uploaded_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE expedition_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access - photos"
  ON expedition_photos FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Client reads own visible photos"
  ON expedition_photos FOR SELECT
  TO authenticated
  USING (
    is_visible_to_client = true
    AND EXISTS (
      SELECT 1 FROM certificate_requests cr
      JOIN profiles p ON p.organization_id = cr.organization_id
      WHERE cr.id = expedition_photos.request_id
        AND p.id = auth.uid()
    )
  );

-- ── 10. BUCKET PARA FOTOS Y ACTAS ────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'expedition-photos',
  'expedition-photos',
  false,
  52428800,  -- 50 MB
  ARRAY['image/jpeg','image/png','image/webp','image/heic','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Admin: gestión total
CREATE POLICY "Admin manage expedition-photos"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'expedition-photos'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    bucket_id = 'expedition-photos'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Cliente: lectura de sus fotos (verificamos via expedition_photos)
CREATE POLICY "Client reads own expedition-photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'expedition-photos'
    AND EXISTS (
      SELECT 1 FROM expedition_photos ep
      JOIN certificate_requests cr ON cr.id = ep.request_id
      JOIN profiles p ON p.organization_id = cr.organization_id
      WHERE ep.storage_path = storage.objects.name
        AND p.id = auth.uid()
        AND ep.is_visible_to_client = true
    )
  );
