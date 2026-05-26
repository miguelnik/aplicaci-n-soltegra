-- ============================================================
-- 0018: CRM (Customer Relationship Management)
--
--   crm_contacts       : personas / leads (con o sin organización)
--   crm_opportunities  : oportunidades comerciales (deals)
--   crm_interactions   : historial de comunicaciones
--
-- Acceso: solo admin y superadmin (RLS).
-- Cualquier admin puede CRUD todo (visibilidad total para colaboración);
-- el owner_id permite agrupar por comercial para KPIs.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Contactos
-- ─────────────────────────────────────────────────────────────
create table if not exists crm_contacts (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null check (length(trim(full_name)) > 0),
  email           text,
  phone           text,
  position        text,
  -- Si el contacto pertenece a una organización ya existente en la plataforma
  organization_id uuid references organizations(id) on delete set null,
  -- Empresa "libre" para leads que aún no son clientes formales
  company_name    text,
  notes           text,
  owner_id        uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_crm_contacts_owner on crm_contacts (owner_id);
create index if not exists idx_crm_contacts_org   on crm_contacts (organization_id);
create index if not exists idx_crm_contacts_email on crm_contacts (lower(email));

create or replace function set_crm_contacts_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists trg_crm_contacts_updated_at on crm_contacts;
create trigger trg_crm_contacts_updated_at
  before update on crm_contacts
  for each row execute function set_crm_contacts_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 2. Oportunidades (deals)
-- ─────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'opportunity_stage') then
    create type opportunity_stage as enum (
      'lead',          -- detectada, sin contacto aún
      'contacted',     -- contacto inicial realizado
      'qualified',     -- cualificada (interés real)
      'proposal',      -- cotización/propuesta enviada
      'negotiation',   -- en negociación
      'won',           -- ganada (cierre)
      'lost'           -- perdida
    );
  end if;
end $$;

create table if not exists crm_opportunities (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null check (length(trim(title)) > 0),
  contact_id          uuid references crm_contacts(id) on delete set null,
  organization_id     uuid references organizations(id) on delete set null,
  owner_id            uuid references profiles(id) on delete set null,
  stage               opportunity_stage not null default 'lead',
  -- Producto/servicio que se está vendiendo
  service_type_id     uuid references service_types(id) on delete set null,
  -- Valor económico estimado
  estimated_value     numeric(12,2),
  -- Fecha estimada de cierre
  expected_close_date date,
  -- Probabilidad de cierre (%)
  probability         int check (probability >= 0 and probability <= 100),
  -- Próxima acción y cuándo
  next_action         text,
  next_action_due     date,
  notes               text,
  -- Razón si se pierde
  lost_reason         text,
  created_by          uuid references profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  won_at              timestamptz,
  lost_at             timestamptz,
  -- Si se convirtió en proyecto real
  converted_to_request_id uuid references certificate_requests(id) on delete set null
);

create index if not exists idx_crm_opp_owner   on crm_opportunities (owner_id);
create index if not exists idx_crm_opp_stage   on crm_opportunities (stage);
create index if not exists idx_crm_opp_contact on crm_opportunities (contact_id);
create index if not exists idx_crm_opp_org     on crm_opportunities (organization_id);
create index if not exists idx_crm_opp_close   on crm_opportunities (expected_close_date);

-- Trigger: updated_at + won_at/lost_at cuando cambia stage
create or replace function set_crm_opp_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();

  -- Si cambia a "won", marcar won_at
  if new.stage = 'won' and (TG_OP = 'INSERT' or old.stage <> 'won') then
    new.won_at := coalesce(new.won_at, now());
    new.lost_at := null;
  end if;

  -- Si cambia a "lost", marcar lost_at
  if new.stage = 'lost' and (TG_OP = 'INSERT' or old.stage <> 'lost') then
    new.lost_at := coalesce(new.lost_at, now());
    new.won_at := null;
  end if;

  -- Si cambia a otro estado, limpiar fechas de cierre
  if new.stage not in ('won', 'lost') then
    new.won_at := null;
    new.lost_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_crm_opp_updated_at on crm_opportunities;
create trigger trg_crm_opp_updated_at
  before insert or update on crm_opportunities
  for each row execute function set_crm_opp_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 3. Historial de interacciones (comunicaciones)
-- ─────────────────────────────────────────────────────────────
create table if not exists crm_interactions (
  id              uuid primary key default gen_random_uuid(),
  contact_id      uuid references crm_contacts(id) on delete set null,
  opportunity_id  uuid references crm_opportunities(id) on delete set null,
  kind            text not null check (kind in ('email','call','meeting','note','whatsapp','other')),
  happened_at     timestamptz not null default now(),
  subject         text,
  summary         text,
  direction       text check (direction in ('inbound','outbound')),
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_crm_inter_contact on crm_interactions (contact_id, happened_at desc);
create index if not exists idx_crm_inter_opp on crm_interactions (opportunity_id, happened_at desc);
create index if not exists idx_crm_inter_creator on crm_interactions (created_by, happened_at desc);

-- ─────────────────────────────────────────────────────────────
-- 4. RLS — sólo admin/superadmin acceden a todo el CRM
-- ─────────────────────────────────────────────────────────────
alter table crm_contacts      enable row level security;
alter table crm_opportunities enable row level security;
alter table crm_interactions  enable row level security;

create policy "admin_crm_contacts"      on crm_contacts      for all using (public.is_admin()) with check (public.is_admin());
create policy "admin_crm_opportunities" on crm_opportunities for all using (public.is_admin()) with check (public.is_admin());
create policy "admin_crm_interactions"  on crm_interactions  for all using (public.is_admin()) with check (public.is_admin());
