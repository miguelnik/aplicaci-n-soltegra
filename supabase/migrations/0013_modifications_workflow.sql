-- ============================================================
-- 0013: Modificaciones (rediseño de Decisiones), fotos en visitas,
--       y trazabilidad de fotos entre secciones
-- ============================================================

-- 1. Trazabilidad de origen en expedition_photos
--    (para que fotos de modificaciones y visitas aparezcan en la galería)
alter table expedition_photos
  add column if not exists source_entity_type text
    check (source_entity_type in ('modification', 'site_visit')),
  add column if not exists source_entity_id uuid;

-- 2. Extender expedition_decisions → ahora es "Modificaciones"
alter table expedition_decisions
  add column if not exists requested_by_id  uuid references profiles(id) on delete set null,
  add column if not exists requested_by_role text check (requested_by_role in ('client', 'admin')),
  add column if not exists cost              numeric(12,2),
  add column if not exists approved_at      timestamptz,
  add column if not exists approved_by_id   uuid references profiles(id) on delete set null,
  add column if not exists rejected_at      timestamptz,
  add column if not exists rejected_by_id   uuid references profiles(id) on delete set null;

-- 3. Tabla de mensajes por modificación (hilo de conversación)
create table if not exists modification_messages (
  id              uuid primary key default gen_random_uuid(),
  modification_id uuid not null references expedition_decisions(id) on delete cascade,
  request_id      uuid not null references certificate_requests(id) on delete cascade,
  author_id       uuid references auth.users(id) on delete set null,
  author_role     text not null check (author_role in ('client', 'admin')),
  body            text not null check (length(trim(body)) > 0),
  created_at      timestamptz not null default now()
);

create index if not exists idx_mod_messages_mod
  on modification_messages (modification_id, created_at);

alter table modification_messages enable row level security;

-- Cliente: leer mensajes de modificaciones de solicitudes de su organización
create policy "client_read_mod_messages"
  on modification_messages for select
  using (
    exists (
      select 1 from certificate_requests cr
      where cr.id = modification_messages.request_id
        and cr.organization_id = public.user_org_id()
    )
  );

-- Cliente: insertar sus propios mensajes
create policy "client_insert_mod_messages"
  on modification_messages for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from certificate_requests cr
      where cr.id = modification_messages.request_id
        and cr.organization_id = public.user_org_id()
    )
  );

-- Admin/superadmin: acceso completo
create policy "admin_mod_messages"
  on modification_messages for all
  using (public.is_admin())
  with check (public.is_admin());

-- 4. Permitir al cliente INSERTAR modificaciones (expedition_decisions)
--    (hasta ahora solo admin podía crear vía server action)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'expedition_decisions'
      and policyname = 'client_insert_modifications'
  ) then
    execute $policy$
      create policy "client_insert_modifications"
        on expedition_decisions for insert
        with check (
          public.user_org_id() is not null
          and exists (
            select 1 from certificate_requests cr
            where cr.id = expedition_decisions.request_id
              and cr.organization_id = public.user_org_id()
          )
        )
    $policy$;
  end if;
end $$;

-- 5. Permitir al cliente UPDATE solo en sus campos de respuesta
--    (approve/reject) en modificaciones creadas por el admin
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'expedition_decisions'
      and policyname = 'client_update_modifications'
  ) then
    execute $policy$
      create policy "client_update_modifications"
        on expedition_decisions for update
        using (
          is_visible_to_client = true
          and exists (
            select 1 from certificate_requests cr
            where cr.id = expedition_decisions.request_id
              and cr.organization_id = public.user_org_id()
          )
        )
        with check (
          exists (
            select 1 from certificate_requests cr
            where cr.id = expedition_decisions.request_id
              and cr.organization_id = public.user_org_id()
          )
        )
    $policy$;
  end if;
end $$;
