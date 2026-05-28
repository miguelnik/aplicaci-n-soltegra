-- ============================================================
-- 0024: Historial de cambios de stage en oportunidades CRM
--
-- Permite calcular tasas de conversión del embudo:
--   "de los que entraron en Contacto, cuántos llegaron a Reunión",
--   "cuántos se perdieron en cada etapa", etc.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Tabla de historial
-- ─────────────────────────────────────────────────────────────
create table if not exists crm_opportunity_stage_history (
  id              uuid primary key default gen_random_uuid(),
  opportunity_id  uuid not null references crm_opportunities(id) on delete cascade,
  from_stage      opportunity_stage,                              -- null en la entrada inicial
  to_stage        opportunity_stage not null,
  changed_at      timestamptz not null default now(),
  changed_by      uuid references profiles(id) on delete set null
);

create index if not exists idx_crm_stage_history_opp
  on crm_opportunity_stage_history (opportunity_id, changed_at desc);
create index if not exists idx_crm_stage_history_to
  on crm_opportunity_stage_history (to_stage);
create index if not exists idx_crm_stage_history_changed_at
  on crm_opportunity_stage_history (changed_at desc);

-- ─────────────────────────────────────────────────────────────
-- 2. RLS
-- ─────────────────────────────────────────────────────────────
alter table crm_opportunity_stage_history enable row level security;

create policy "admin_stage_history_all"
  on crm_opportunity_stage_history
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 3. Trigger que registra cada cambio de stage
-- ─────────────────────────────────────────────────────────────
create or replace function record_opportunity_stage_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into crm_opportunity_stage_history (opportunity_id, from_stage, to_stage, changed_at, changed_by)
    values (new.id, null, new.stage, coalesce(new.created_at, now()), new.created_by);
  elsif TG_OP = 'UPDATE' and new.stage is distinct from old.stage then
    insert into crm_opportunity_stage_history (opportunity_id, from_stage, to_stage, changed_at, changed_by)
    values (new.id, old.stage, new.stage, now(), auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_record_opportunity_stage_change on crm_opportunities;
create trigger trg_record_opportunity_stage_change
  after insert or update of stage on crm_opportunities
  for each row execute function record_opportunity_stage_change();

-- ─────────────────────────────────────────────────────────────
-- 4. Backfill — registra el stage actual de las oportunidades que ya existen
--    para que aparezcan en las estadísticas (best-effort, sin historial real)
-- ─────────────────────────────────────────────────────────────
insert into crm_opportunity_stage_history (opportunity_id, from_stage, to_stage, changed_at, changed_by)
select o.id, null, o.stage, o.created_at, o.created_by
from crm_opportunities o
where not exists (
  select 1 from crm_opportunity_stage_history h where h.opportunity_id = o.id
);
