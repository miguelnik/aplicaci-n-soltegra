-- ============================================================
-- 0016: Imputación de horas + rentabilidad real por proyecto
--   - profiles.hourly_cost            : tarifa coste/hora por trabajador
--   - certificate_requests.is_general_overhead : flag de proyecto-overhead
--   - time_entries                    : horas imputadas
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Tarifa coste/hora por trabajador
-- ─────────────────────────────────────────────────────────────
alter table profiles
  add column if not exists hourly_cost numeric(8,2);

-- ─────────────────────────────────────────────────────────────
-- 2. Flag de proyecto de overhead (gastos generales)
--    Los proyectos overhead acumulan horas internas no atribuibles
--    a un proyecto concreto (admin general, formación, comercial).
--    Sus horas se prorratean entre todos los proyectos activos.
--    Al activar el flag, el proyecto se oculta automáticamente al cliente.
-- ─────────────────────────────────────────────────────────────
alter table certificate_requests
  add column if not exists is_general_overhead boolean not null default false;

create index if not exists idx_requests_overhead
  on certificate_requests (is_general_overhead) where is_general_overhead = true;

-- Trigger: al marcar overhead, ocultar automáticamente al cliente
create or replace function auto_hide_overhead_projects()
returns trigger
language plpgsql
as $$
begin
  if new.is_general_overhead is true then
    new.is_hidden_from_client := true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_hide_overhead on certificate_requests;
create trigger trg_auto_hide_overhead
  before insert or update of is_general_overhead on certificate_requests
  for each row execute function auto_hide_overhead_projects();

-- ─────────────────────────────────────────────────────────────
-- 3. Tabla de horas imputadas
--    hourly_cost_snapshot guarda la tarifa al momento de la imputación,
--    para que cambios futuros de tarifa no recalculen retroactivamente.
-- ─────────────────────────────────────────────────────────────
create table if not exists time_entries (
  id                   uuid primary key default gen_random_uuid(),
  worker_id            uuid not null references profiles(id) on delete cascade,
  request_id           uuid references certificate_requests(id) on delete set null,
  entry_date           date not null,
  hours                numeric(5,2) not null check (hours > 0 and hours <= 24),
  description          text,
  -- Snapshot del coste/hora del trabajador en el momento de la imputación
  hourly_cost_snapshot numeric(8,2),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_time_entries_worker_date
  on time_entries (worker_id, entry_date desc);
create index if not exists idx_time_entries_request
  on time_entries (request_id) where request_id is not null;
create index if not exists idx_time_entries_date
  on time_entries (entry_date);

create or replace function set_time_entries_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_time_entries_updated_at on time_entries;
create trigger trg_time_entries_updated_at
  before update on time_entries
  for each row execute function set_time_entries_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 4. RLS
-- ─────────────────────────────────────────────────────────────
alter table time_entries enable row level security;

-- Admins/superadmins leen todas las horas (para informes y vistas de proyecto)
create policy "admin_select_time_entries"
  on time_entries for select
  using (public.is_admin());

-- Los workers (admins) insertan sus propias horas
create policy "admin_insert_own_time"
  on time_entries for insert
  with check (
    public.is_admin()
    and worker_id = auth.uid()
  );

-- Los workers (admins) actualizan/eliminan sus propias horas
create policy "admin_update_own_time"
  on time_entries for update
  using (public.is_admin() and worker_id = auth.uid())
  with check (public.is_admin() and worker_id = auth.uid());

create policy "admin_delete_own_time"
  on time_entries for delete
  using (public.is_admin() and worker_id = auth.uid());

-- Superadmin puede TODO (editar horas de otros, p.ej. para correcciones)
create policy "superadmin_all_time"
  on time_entries for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'superadmin'
    )
  )
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'superadmin'
    )
  );
