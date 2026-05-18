-- ============================================================
-- 0014: Cimientos del ERP interno
--   1. Precio y visibilidad en solicitudes
--   2. Tabla unificada de apuntes contables (finance_entries)
--   3. Helper is_admin() (defensivo, por si no existe)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Helper is_admin() — defensivo, sólo crea si no existe
-- ─────────────────────────────────────────────────────────────
create or replace function public.is_admin() returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('admin', 'superadmin')
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. Precio + flag de oculto al cliente en solicitudes
-- ─────────────────────────────────────────────────────────────
alter table certificate_requests
  add column if not exists price                  numeric(12,2),
  add column if not exists is_hidden_from_client  boolean not null default false;

-- Índices útiles para listados y P&L
create index if not exists idx_requests_hidden
  on certificate_requests (is_hidden_from_client);
create index if not exists idx_requests_paid_at
  on certificate_requests (paid_at) where paid_at is not null;

-- ─────────────────────────────────────────────────────────────
-- 3. RLS: clientes nunca ven solicitudes ocultas
-- ─────────────────────────────────────────────────────────────
-- La política original combinaba cliente y admin con OR. La sustituimos
-- por dos políticas separadas para añadir el filtro de is_hidden_from_client
-- únicamente al lado cliente, manteniendo acceso completo al admin.
drop policy if exists requests_select_own_org on certificate_requests;

-- Cliente: lee sólo solicitudes de su organización que NO estén ocultas
create policy requests_select_client
  on certificate_requests for select
  using (
    organization_id = public.user_org_id()
    and is_hidden_from_client = false
  );

-- Admin/superadmin: lee todas, incluidas las ocultas
create policy requests_select_admin
  on certificate_requests for select
  using (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 4. Tabla unificada de apuntes contables
-- ─────────────────────────────────────────────────────────────
create table if not exists finance_entries (
  id              uuid primary key default gen_random_uuid(),

  -- Tipo: ingreso o gasto
  kind            text not null check (kind in ('income', 'expense')),

  -- Categoría (depende del tipo)
  --   income:  certificate, project, construction, architecture, other
  --   expense: mobility, subcontractor, salaries, admin, assets, other
  category        text not null,

  -- Sólo para gastos: variable o fijo (margen bruto vs Opex)
  cost_type       text check (cost_type in ('variable', 'fixed')),

  -- Importe siempre positivo (el signo viene de kind)
  amount          numeric(12,2) not null check (amount >= 0),

  -- Fecha de devengo (cuando ocurre el ingreso/gasto, no cuando se cobra)
  entry_date      date not null,

  description     text,
  notes           text,

  -- Estado de cobro / pago
  is_settled      boolean not null default false,
  settled_at      timestamptz,

  -- Trazabilidad: si proviene de un proyecto y/o cliente
  request_id      uuid references certificate_requests(id) on delete set null,
  organization_id uuid references organizations(id) on delete set null,

  -- Auditoría
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Coherencia: si es gasto, debe tener cost_type
  constraint expense_needs_cost_type
    check (kind <> 'expense' or cost_type is not null)
);

-- Índices para el dashboard, listados y P&L
create index if not exists idx_finance_kind_date
  on finance_entries (kind, entry_date desc);
create index if not exists idx_finance_request
  on finance_entries (request_id);
create index if not exists idx_finance_org
  on finance_entries (organization_id);
create index if not exists idx_finance_settled
  on finance_entries (is_settled, entry_date);

-- Trigger para updated_at automático
create or replace function set_finance_entries_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_finance_entries_updated_at on finance_entries;
create trigger trg_finance_entries_updated_at
  before update on finance_entries
  for each row execute function set_finance_entries_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 5. RLS de finance_entries: SOLO admin/superadmin
-- ─────────────────────────────────────────────────────────────
alter table finance_entries enable row level security;

create policy "admin_finance_all"
  on finance_entries for all
  using (public.is_admin())
  with check (public.is_admin());

-- Los clientes no tienen ninguna política → no pueden leer ni escribir
