-- ============================================================
-- 0026: Leads entrantes desde la web (soltegra.es)
--
-- Añade trazabilidad e idempotencia para los leads que llegan
-- desde el formulario de contacto público a través del endpoint
-- POST /api/leads/inbound.
--
-- - source: marca el origen (web_form, manual, …).
-- - source_submission_id: id de la submission de Payload en
--   la web pública. Permite no duplicar oportunidad si la web
--   reintenta el push.
-- ============================================================

alter table crm_opportunities
  add column if not exists source text,
  add column if not exists source_submission_id text;

-- Índice único parcial: una oportunidad por submission de la web.
-- Si source_submission_id es null (oportunidad manual del CRM), no aplica.
create unique index if not exists uq_crm_opp_source_submission
  on crm_opportunities (source_submission_id)
  where source_submission_id is not null;

-- Mismo planteamiento para contactos: si el lead trae email, lo deduplicamos
-- por email en el código del endpoint; pero también queremos saber de dónde
-- vino la primera vez que se creó.
alter table crm_contacts
  add column if not exists source text;
