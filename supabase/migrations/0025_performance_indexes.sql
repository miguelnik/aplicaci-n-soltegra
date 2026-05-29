-- ============================================================
-- 0025: Índices de rendimiento sobre filtros frecuentes
--
-- Sólo CREATE INDEX IF NOT EXISTS — idempotente y sin riesgo.
-- Cubre los filtros .eq("request_id", ...), .eq("opportunity_id", ...)
-- y .eq("contact_id", ...) usados en muchas pantallas.
-- ============================================================

-- Módulos del expediente (todos filtran por request_id)
create index if not exists idx_exp_documents_request    on expedition_documents (request_id);
create index if not exists idx_exp_milestones_request   on expedition_milestones (request_id);
create index if not exists idx_exp_decisions_request    on expedition_decisions (request_id);
create index if not exists idx_exp_incidents_request    on expedition_incidents (request_id);
create index if not exists idx_exp_risks_request        on expedition_risks (request_id);
create index if not exists idx_exp_site_visits_request  on expedition_site_visits (request_id);
create index if not exists idx_exp_meeting_minutes_req  on expedition_meeting_minutes (request_id);
create index if not exists idx_exp_photos_request       on expedition_photos (request_id);
create index if not exists idx_exp_attachments_request  on expedition_attachments (request_id);
create index if not exists idx_exp_cost_items_request   on expedition_cost_items (request_id);
create index if not exists idx_exp_budget_request       on expedition_budget (request_id);

-- Solicitudes / proyectos
create index if not exists idx_requests_org_created     on certificate_requests (organization_id, created_at desc);
create index if not exists idx_requests_status          on certificate_requests (status) where status not in ('draft','cancelled');
create index if not exists idx_request_files_request    on request_files (request_id);
create index if not exists idx_request_messages_request on request_messages (request_id, created_at desc);

-- CRM
create index if not exists idx_crm_interactions_contact on crm_interactions (contact_id, happened_at desc) where contact_id is not null;
create index if not exists idx_crm_interactions_opp     on crm_interactions (opportunity_id, happened_at desc) where opportunity_id is not null;
create index if not exists idx_crm_contacts_owner_upd   on crm_contacts (owner_id, updated_at desc);
create index if not exists idx_crm_opp_owner_updated    on crm_opportunities (owner_id, updated_at desc);
create index if not exists idx_crm_opp_org              on crm_opportunities (organization_id) where organization_id is not null;
create index if not exists idx_crm_opp_contact          on crm_opportunities (contact_id) where contact_id is not null;

-- Tareas
create index if not exists idx_user_tasks_request       on user_tasks (request_id) where request_id is not null;
create index if not exists idx_user_tasks_opp           on user_tasks (opportunity_id) where opportunity_id is not null;
create index if not exists idx_user_tasks_contact       on user_tasks (contact_id) where contact_id is not null;

-- Horas
create index if not exists idx_time_entries_request_date on time_entries (request_id, entry_date desc) where request_id is not null;

-- Finanzas
create index if not exists idx_finance_request          on finance_entries (request_id) where request_id is not null;
create index if not exists idx_finance_org              on finance_entries (organization_id) where organization_id is not null;
create index if not exists idx_finance_kind_date        on finance_entries (kind, entry_date desc);

-- Presupuestos
create index if not exists idx_budgets_org              on budgets (organization_id) where organization_id is not null;
create index if not exists idx_budgets_opp              on budgets (opportunity_id) where opportunity_id is not null;
create index if not exists idx_budget_items_budget      on budget_items (budget_id);
create index if not exists idx_budget_template_items_tpl on budget_template_items (template_id);

-- Mensajes de modificaciones
create index if not exists idx_modification_messages_mod on modification_messages (modification_id, created_at);
