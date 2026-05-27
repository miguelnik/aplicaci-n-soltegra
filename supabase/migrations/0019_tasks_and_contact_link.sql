-- ============================================================
-- 0019: Sistema de tareas pendientes + sync contacto↔usuario
--
--   1. user_tasks: tareas personales y entre usuarios
--   2. crm_contacts.linked_user_id: vínculo contacto → usuario
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Vínculo contacto ↔ usuario (cuando un contacto pasa a ser cliente)
-- ─────────────────────────────────────────────────────────────
alter table crm_contacts
  add column if not exists linked_user_id uuid references profiles(id) on delete set null;

create index if not exists idx_crm_contacts_linked_user
  on crm_contacts (linked_user_id) where linked_user_id is not null;

-- ─────────────────────────────────────────────────────────────
-- 2. Tareas pendientes
-- ─────────────────────────────────────────────────────────────
create table if not exists user_tasks (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (length(trim(title)) > 0),
  description     text,
  -- Persona asignada
  assignee_id     uuid not null references profiles(id) on delete cascade,
  -- Quién la creó (puede ser distinto del assignee)
  created_by      uuid references profiles(id) on delete set null,
  -- Cuándo hay que hacerla (fecha + hora opcional)
  due_at          timestamptz,
  -- Prioridad
  priority        text not null default 'medium' check (priority in ('low','medium','high')),
  -- Estado
  status          text not null default 'pending' check (status in ('pending','done','dismissed')),
  -- Vínculos opcionales con CRM y proyectos
  opportunity_id  uuid references crm_opportunities(id) on delete set null,
  contact_id      uuid references crm_contacts(id) on delete set null,
  request_id      uuid references certificate_requests(id) on delete set null,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_user_tasks_assignee
  on user_tasks (assignee_id, status, due_at);
create index if not exists idx_user_tasks_creator
  on user_tasks (created_by, status);
create index if not exists idx_user_tasks_due
  on user_tasks (due_at) where status = 'pending' and due_at is not null;
create index if not exists idx_user_tasks_opp on user_tasks (opportunity_id) where opportunity_id is not null;
create index if not exists idx_user_tasks_contact on user_tasks (contact_id) where contact_id is not null;

-- Trigger: updated_at + completed_at automático cuando pasa a done
create or replace function set_user_tasks_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.status = 'done' and (TG_OP = 'INSERT' or old.status <> 'done') then
    new.completed_at := coalesce(new.completed_at, now());
  end if;
  if new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_user_tasks_updated_at on user_tasks;
create trigger trg_user_tasks_updated_at
  before insert or update on user_tasks
  for each row execute function set_user_tasks_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 3. RLS — admin/superadmin acceden; cada uno ve las suyas y las que creó.
-- Superadmin ve todas.
-- ─────────────────────────────────────────────────────────────
alter table user_tasks enable row level security;

-- SELECT: superadmin ve todo; admin ve las que es assignee o creator
create policy "user_tasks_select_own_or_super"
  on user_tasks for select
  using (
    public.is_admin() and (
      assignee_id = auth.uid()
      or created_by = auth.uid()
      or exists (
        select 1 from profiles where id = auth.uid() and role = 'superadmin'
      )
    )
  );

-- INSERT: cualquier admin puede crear (puede asignar a otros)
create policy "user_tasks_insert_admin"
  on user_tasks for insert
  with check (
    public.is_admin()
    and (created_by = auth.uid() or created_by is null)
  );

-- UPDATE: el assignee o el creator pueden actualizar; superadmin todo
create policy "user_tasks_update"
  on user_tasks for update
  using (
    public.is_admin() and (
      assignee_id = auth.uid()
      or created_by = auth.uid()
      or exists (
        select 1 from profiles where id = auth.uid() and role = 'superadmin'
      )
    )
  )
  with check (
    public.is_admin() and (
      assignee_id = auth.uid()
      or created_by = auth.uid()
      or exists (
        select 1 from profiles where id = auth.uid() and role = 'superadmin'
      )
    )
  );

-- DELETE: solo creator o superadmin
create policy "user_tasks_delete"
  on user_tasks for delete
  using (
    public.is_admin() and (
      created_by = auth.uid()
      or exists (
        select 1 from profiles where id = auth.uid() and role = 'superadmin'
      )
    )
  );
