-- ============================================================
-- 0021: Biblioteca de conceptos / partidas reutilizables
--
-- Diferencia con plantillas:
--   - Una plantilla = paquete completo de partidas que se aplica de golpe
--   - Un concepto = una sola partida reutilizable, se inserta de uno en uno
--
-- Caso de uso: en mitad de un presupuesto, añadir "Visita técnica" sin
-- tener que crear una plantilla entera con esa única línea.
-- ============================================================

create table if not exists budget_concept_library (
  id              uuid primary key default gen_random_uuid(),
  concept         text not null check (length(trim(concept)) > 0),
  description     text,
  unit            text default 'ud',
  unit_price      numeric(12,2) not null default 0 check (unit_price >= 0),
  default_quantity numeric(10,2) default 1 check (default_quantity >= 0),
  service_type_id uuid references service_types(id) on delete set null,
  is_active       boolean not null default true,
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_budget_concepts_active on budget_concept_library (is_active);
create index if not exists idx_budget_concepts_service on budget_concept_library (service_type_id);
create index if not exists idx_budget_concepts_concept on budget_concept_library (lower(concept));

create or replace function set_budget_concepts_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists trg_budget_concepts_updated_at on budget_concept_library;
create trigger trg_budget_concepts_updated_at
  before update on budget_concept_library
  for each row execute function set_budget_concepts_updated_at();

alter table budget_concept_library enable row level security;

create policy "admin_budget_concepts" on budget_concept_library for all
  using (public.is_admin()) with check (public.is_admin());
