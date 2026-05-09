-- Seguimiento de facturación: campo para marcar si un certificado está cobrado
alter table certificate_requests
  add column if not exists is_paid boolean not null default false,
  add column if not exists paid_at timestamptz default null;

-- Índice para filtrar rápidamente pagados/pendientes por organización
create index if not exists idx_certificate_requests_paid
  on certificate_requests (organization_id, is_paid)
  where status <> 'cancelled' and status <> 'draft';
