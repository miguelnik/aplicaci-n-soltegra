-- ============================================================
-- 0020: Sistema de presupuestos
--
--   company_settings        : datos fiscales de la empresa (singleton)
--   budget_templates        : plantillas reutilizables
--   budget_template_items   : líneas de plantilla
--   budgets                 : presupuestos
--   budget_items            : líneas de presupuesto
--   budget_number_seq       : secuencia anual de numeración
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Ajustes de empresa (singleton)
-- ─────────────────────────────────────────────────────────────
create table if not exists company_settings (
  id              uuid primary key default gen_random_uuid(),
  legal_name      text not null default 'Soltegra',
  trade_name      text,
  cif             text,
  address_line1   text,
  address_line2   text,
  postal_code     text,
  city            text,
  province        text,
  country         text default 'España',
  phone           text,
  email           text,
  website         text,
  iban            text,
  -- Texto libre de condiciones que aparecerá al pie del PDF
  payment_terms   text,
  legal_notes     text,
  -- IVA por defecto en %
  default_vat     numeric(5,2) not null default 21,
  -- Prefijo para presupuestos (ej. PRES, SOLT...)
  budget_prefix   text not null default 'PRES',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Insertar fila inicial si no existe ninguna
insert into company_settings (legal_name)
  select 'Soltegra'
  where not exists (select 1 from company_settings);

create or replace function set_company_settings_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists trg_company_settings_updated_at on company_settings;
create trigger trg_company_settings_updated_at
  before update on company_settings
  for each row execute function set_company_settings_updated_at();

-- RLS: leer cualquier admin/superadmin. Editar solo superadmin.
alter table company_settings enable row level security;

create policy "admin_read_company"
  on company_settings for select
  using (public.is_admin());

create policy "superadmin_update_company"
  on company_settings for update
  using (exists (select 1 from profiles where id = auth.uid() and role = 'superadmin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'superadmin'));

-- ─────────────────────────────────────────────────────────────
-- 2. Plantillas de presupuesto
-- ─────────────────────────────────────────────────────────────
create table if not exists budget_templates (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(trim(name)) > 0),
  description     text,
  service_type_id uuid references service_types(id) on delete set null,
  is_active       boolean not null default true,
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create or replace function set_budget_templates_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists trg_budget_templates_updated_at on budget_templates;
create trigger trg_budget_templates_updated_at
  before update on budget_templates
  for each row execute function set_budget_templates_updated_at();

create table if not exists budget_template_items (
  id              uuid primary key default gen_random_uuid(),
  template_id     uuid not null references budget_templates(id) on delete cascade,
  position        int not null default 0,
  concept         text not null check (length(trim(concept)) > 0),
  description     text,
  quantity        numeric(10,2) not null default 1 check (quantity >= 0),
  unit            text default 'ud',
  unit_price      numeric(12,2) not null default 0 check (unit_price >= 0),
  -- Descuento en % por línea (0 por defecto)
  discount_pct    numeric(5,2) not null default 0 check (discount_pct >= 0 and discount_pct <= 100)
);

create index if not exists idx_budget_template_items_template
  on budget_template_items (template_id, position);

alter table budget_templates enable row level security;
alter table budget_template_items enable row level security;

create policy "admin_budget_templates" on budget_templates for all
  using (public.is_admin()) with check (public.is_admin());
create policy "admin_budget_template_items" on budget_template_items for all
  using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 3. Estados del presupuesto
-- ─────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'budget_status') then
    create type budget_status as enum (
      'draft',     -- borrador, editable
      'sent',      -- enviado al cliente
      'accepted',  -- aceptado (cierre)
      'rejected',  -- rechazado por el cliente
      'expired'    -- expirado sin respuesta
    );
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 4. Presupuestos
-- ─────────────────────────────────────────────────────────────
create table if not exists budgets (
  id                  uuid primary key default gen_random_uuid(),
  -- Numeración correlativa anual (ej. PRES-2026-0001)
  number              text unique,
  year                int not null default extract(year from now())::int,
  -- Relaciones con CRM y plataforma (todas opcionales — flexibilidad)
  contact_id          uuid references crm_contacts(id) on delete set null,
  organization_id     uuid references organizations(id) on delete set null,
  opportunity_id      uuid references crm_opportunities(id) on delete set null,
  -- Cuando se acepta y se convierte en proyecto:
  converted_to_request_id uuid references certificate_requests(id) on delete set null,
  -- Datos editables capturados del cliente al momento de emitir (para que no cambien después)
  client_legal_name   text,
  client_cif          text,
  client_address      text,
  client_email        text,
  client_phone        text,
  -- Cabecera
  title               text not null check (length(trim(title)) > 0),
  intro               text,
  -- IVA (en %)
  vat_pct             numeric(5,2) not null default 21,
  -- Fechas
  issue_date          date not null default current_date,
  valid_until         date,
  -- Estado
  status              budget_status not null default 'draft',
  -- Texto al pie editable por presupuesto (anula defaults si se rellena)
  payment_terms       text,
  legal_notes         text,
  -- Auditoría de cambios de estado
  sent_at             timestamptz,
  accepted_at         timestamptz,
  rejected_at         timestamptz,
  rejection_reason    text,
  -- Comercial responsable
  owner_id            uuid references profiles(id) on delete set null,
  created_by          uuid references profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_budgets_status     on budgets (status);
create index if not exists idx_budgets_contact    on budgets (contact_id);
create index if not exists idx_budgets_org        on budgets (organization_id);
create index if not exists idx_budgets_opp        on budgets (opportunity_id);
create index if not exists idx_budgets_owner      on budgets (owner_id);
create index if not exists idx_budgets_year       on budgets (year, issue_date desc);

-- Líneas del presupuesto
create table if not exists budget_items (
  id              uuid primary key default gen_random_uuid(),
  budget_id       uuid not null references budgets(id) on delete cascade,
  position        int not null default 0,
  concept         text not null check (length(trim(concept)) > 0),
  description     text,
  quantity        numeric(10,2) not null default 1 check (quantity >= 0),
  unit            text default 'ud',
  unit_price      numeric(12,2) not null default 0 check (unit_price >= 0),
  discount_pct    numeric(5,2) not null default 0 check (discount_pct >= 0 and discount_pct <= 100)
);

create index if not exists idx_budget_items_budget on budget_items (budget_id, position);

-- ─────────────────────────────────────────────────────────────
-- 5. Triggers de actualización + estados
-- ─────────────────────────────────────────────────────────────
create or replace function set_budgets_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  -- Marcado automático de fechas de estado
  if new.status = 'sent' and (TG_OP = 'INSERT' or old.status <> 'sent') then
    new.sent_at := coalesce(new.sent_at, now());
  end if;
  if new.status = 'accepted' and (TG_OP = 'INSERT' or old.status <> 'accepted') then
    new.accepted_at := coalesce(new.accepted_at, now());
    new.rejected_at := null;
  end if;
  if new.status = 'rejected' and (TG_OP = 'INSERT' or old.status <> 'rejected') then
    new.rejected_at := coalesce(new.rejected_at, now());
    new.accepted_at := null;
  end if;
  if new.status not in ('accepted','rejected') then
    new.accepted_at := null;
    new.rejected_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_budgets_updated_at on budgets;
create trigger trg_budgets_updated_at
  before insert or update on budgets
  for each row execute function set_budgets_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 6. Numeración correlativa anual (atómica)
-- ─────────────────────────────────────────────────────────────
create table if not exists budget_number_seq (
  year       int primary key,
  last_value int not null default 0
);

-- Función que devuelve el siguiente número formateado (PRES-2026-0001)
create or replace function next_budget_number()
returns text
language plpgsql
security definer
as $$
declare
  y int;
  n int;
  prefix text;
begin
  y := extract(year from now())::int;

  -- Lock fila del año para concurrencia
  insert into budget_number_seq (year, last_value)
    values (y, 0)
    on conflict (year) do nothing;

  update budget_number_seq
    set last_value = last_value + 1
    where year = y
    returning last_value into n;

  select coalesce(budget_prefix, 'PRES') into prefix from company_settings limit 1;

  return prefix || '-' || y || '-' || lpad(n::text, 4, '0');
end;
$$;

-- Asignar número automáticamente al crear si no se especificó
create or replace function assign_budget_number() returns trigger
language plpgsql as $$
begin
  if new.number is null then
    new.number := next_budget_number();
  end if;
  new.year := extract(year from coalesce(new.issue_date, current_date))::int;
  return new;
end;
$$;

drop trigger if exists trg_assign_budget_number on budgets;
create trigger trg_assign_budget_number
  before insert on budgets
  for each row execute function assign_budget_number();

-- ─────────────────────────────────────────────────────────────
-- 7. RLS de presupuestos
-- ─────────────────────────────────────────────────────────────
alter table budgets enable row level security;
alter table budget_items enable row level security;

create policy "admin_budgets" on budgets for all
  using (public.is_admin()) with check (public.is_admin());

create policy "admin_budget_items" on budget_items for all
  using (public.is_admin()) with check (public.is_admin());
