-- =====================================================================
-- 0006: hilo de mensajes admin ↔ cliente por solicitud
-- =====================================================================
-- Reemplaza `client_notes` (texto único sobrescribible) por una tabla de
-- mensajes en hilo (tipo conversación de email). Cada mensaje queda
-- fijado con su autor, rol y fecha; el cliente ve el hilo entero.

create table if not exists request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references certificate_requests(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  author_role user_role not null,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_request_messages_request
  on request_messages (request_id, created_at);

alter table request_messages enable row level security;

-- Cliente: lee mensajes de solicitudes de su organización
create policy "client_read_messages"
  on request_messages for select
  using (
    exists (
      select 1 from certificate_requests cr
      where cr.id = request_messages.request_id
        and cr.organization_id = public.user_org_id()
    )
  );

-- Cliente: puede escribir mensajes en sus solicitudes (excepto cancelled/draft)
create policy "client_write_messages"
  on request_messages for insert
  with check (
    author_id = auth.uid()
    and author_role = 'client'
    and exists (
      select 1 from certificate_requests cr
      where cr.id = request_messages.request_id
        and cr.organization_id = public.user_org_id()
        and cr.status not in ('draft', 'cancelled')
    )
  );

-- Admin: lee todos los mensajes
create policy "admin_read_messages"
  on request_messages for select
  using (public.is_admin());

-- Admin: puede escribir mensajes en cualquier solicitud
create policy "admin_write_messages"
  on request_messages for insert
  with check (
    public.is_admin()
    and author_id = auth.uid()
    and author_role = 'admin'
  );
