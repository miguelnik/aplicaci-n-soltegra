-- ============================================================================
-- Soltegra · Plataforma de Certificados Energéticos
-- Migración inicial: tablas, enums, RLS y helpers.
-- ============================================================================

-- Extensiones
create extension if not exists pgcrypto;

-- ============================================================================
-- ENUMS
-- ============================================================================

create type user_role as enum ('admin', 'client');

create type request_status as enum (
  'draft',          -- cliente lo está rellenando
  'submitted',      -- cliente lo envió, admin no lo ha visto
  'in_review',      -- admin revisando documentación
  'in_progress',    -- en redacción
  'awaiting_info',  -- bloqueado, falta info adicional del cliente
  'delivered',      -- PDF entregado
  'cancelled'
);

-- ============================================================================
-- TABLAS
-- ============================================================================

-- Organizaciones (clientes finales: promotora, inmobiliaria, particular).
-- Una org tiene N usuarios. Para particulares, una org de un único miembro.
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cif text,                            -- CIF/NIF de España
  contact_email text,
  contact_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Perfiles de usuario (1:1 con auth.users de Supabase).
-- Los admins de Soltegra tienen organization_id = NULL y role = 'admin'.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete restrict,
  role user_role not null default 'client',
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_admin_no_org check (
    (role = 'admin' and organization_id is null) or
    (role = 'client' and organization_id is not null)
  )
);
create index profiles_organization_id_idx on profiles (organization_id);
create index profiles_role_idx on profiles (role);

-- Schema del formulario que rellena el cliente. VERSIONADO.
-- Cada edición del admin crea una fila NUEVA con version + 1 e is_current = true
-- (transacción que pone los demás a false).
-- Las solicitudes guardan FK a una versión concreta para no romperse al editar.
create table form_schemas (
  id uuid primary key default gen_random_uuid(),
  version int not null,
  is_current boolean not null default false,
  is_draft boolean not null default false,         -- borrador antes de publicar
  schema jsonb not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (version)
);
-- Solo puede haber un schema "current" simultáneamente.
create unique index form_schemas_one_current
  on form_schemas (is_current) where is_current = true;

-- Solicitudes de certificado.
create table certificate_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  created_by uuid not null references profiles(id) on delete restrict,
  form_schema_id uuid not null references form_schemas(id) on delete restrict,
  form_data jsonb not null default '{}'::jsonb,
  status request_status not null default 'draft',
  property_address text,                           -- denormalizado para listas
  reference_code text unique,                      -- ej. SOL-2026-0042
  estimated_delivery_date date,
  delivered_at timestamptz,
  certificate_pdf_path text,                       -- ruta en bucket `certificates`
  internal_notes text,                             -- visible solo a admin
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index certificate_requests_org_idx on certificate_requests (organization_id);
create index certificate_requests_status_idx on certificate_requests (status);
create index certificate_requests_created_by_idx on certificate_requests (created_by);

-- Archivos subidos por el cliente para una solicitud.
create table request_files (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references certificate_requests(id) on delete cascade,
  field_key text not null,                         -- corresponde al campo del schema
  storage_path text not null,                      -- ruta dentro de bucket `request-uploads`
  original_filename text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references profiles(id) on delete set null,
  uploaded_at timestamptz not null default now()
);
create index request_files_request_idx on request_files (request_id);

-- Log de notificaciones email (para auditoría / reintentos).
create table email_notifications (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  template text not null,                          -- ej. 'new_request_admin'
  payload jsonb not null,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);
create index email_notifications_unsent_idx
  on email_notifications (created_at) where sent_at is null;

-- ============================================================================
-- TRIGGERS de updated_at
-- ============================================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_updated_at before update on organizations
  for each row execute function set_updated_at();
create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger certificate_requests_updated_at before update on certificate_requests
  for each row execute function set_updated_at();

-- ============================================================================
-- HELPERS para RLS
-- ============================================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.user_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table form_schemas enable row level security;
alter table certificate_requests enable row level security;
alter table request_files enable row level security;
alter table email_notifications enable row level security;

-- ---------- profiles ----------
-- Cliente puede ver su propio perfil y los perfiles de su misma org (compañeros).
create policy profiles_select_own_or_org on profiles for select
  using (
    id = auth.uid()
    or (organization_id is not null and organization_id = public.user_org_id())
    or public.is_admin()
  );
-- Cliente puede actualizar su propio perfil (nombre, teléfono).
create policy profiles_update_own on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));
-- Admin gestiona todos los perfiles.
create policy profiles_admin_all on profiles for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- organizations ----------
create policy organizations_select_own_or_admin on organizations for select
  using (id = public.user_org_id() or public.is_admin());
create policy organizations_admin_all on organizations for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- form_schemas ----------
-- Cualquier autenticado puede leer (necesario para renderizar el formulario).
create policy form_schemas_select_authenticated on form_schemas for select
  using (auth.role() = 'authenticated');
-- Solo admin escribe / edita.
create policy form_schemas_admin_write on form_schemas for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- certificate_requests ----------
-- Cliente lee todas las solicitudes de su organización.
create policy requests_select_own_org on certificate_requests for select
  using (organization_id = public.user_org_id() or public.is_admin());
-- Cliente crea solicitudes solo en su propia organización y como creador.
create policy requests_insert_own on certificate_requests for insert
  with check (
    organization_id = public.user_org_id()
    and created_by = auth.uid()
    and status = 'draft'
  );
-- Cliente actualiza solo sus borradores. NO puede cambiar status libremente:
-- las transiciones de estado se hacen via RPC submit_request().
create policy requests_update_own_draft on certificate_requests for update
  using (
    organization_id = public.user_org_id()
    and status = 'draft'
  )
  with check (
    organization_id = public.user_org_id()
    and status = 'draft'
  );
-- Admin gestiona todas.
create policy requests_admin_all on certificate_requests for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- request_files ----------
create policy request_files_select_own_or_admin on request_files for select
  using (
    public.is_admin()
    or exists (
      select 1 from certificate_requests r
      where r.id = request_id and r.organization_id = public.user_org_id()
    )
  );
create policy request_files_insert_own_draft on request_files for insert
  with check (
    exists (
      select 1 from certificate_requests r
      where r.id = request_id
        and r.organization_id = public.user_org_id()
        and r.status = 'draft'
    )
  );
create policy request_files_delete_own_draft on request_files for delete
  using (
    public.is_admin()
    or exists (
      select 1 from certificate_requests r
      where r.id = request_id
        and r.organization_id = public.user_org_id()
        and r.status = 'draft'
    )
  );
create policy request_files_admin_all on request_files for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- email_notifications ----------
-- Solo service_role accede (no exponer a cliente).
create policy email_notifications_service_only on email_notifications for all
  using (false)
  with check (false);

-- ============================================================================
-- RPCs (transiciones de estado)
-- ============================================================================

-- Cliente envía su borrador. Valida transición draft -> submitted.
create or replace function public.submit_request(p_request_id uuid)
returns certificate_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  r certificate_requests;
begin
  select * into r from certificate_requests where id = p_request_id;

  if not found then
    raise exception 'request_not_found';
  end if;

  -- Solo el dueño de la org puede enviar.
  if r.organization_id <> public.user_org_id() and not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  if r.status <> 'draft' then
    raise exception 'invalid_status_transition: % -> submitted', r.status;
  end if;

  update certificate_requests
  set status = 'submitted'
  where id = p_request_id
  returning * into r;

  return r;
end;
$$;

-- Admin cambia el estado libremente entre estados no terminales.
create or replace function public.admin_update_request_status(
  p_request_id uuid,
  p_new_status request_status,
  p_estimated_delivery_date date default null,
  p_internal_notes text default null
)
returns certificate_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  r certificate_requests;
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  update certificate_requests
  set
    status = p_new_status,
    estimated_delivery_date = coalesce(p_estimated_delivery_date, estimated_delivery_date),
    internal_notes = coalesce(p_internal_notes, internal_notes),
    delivered_at = case when p_new_status = 'delivered' and delivered_at is null then now() else delivered_at end
  where id = p_request_id
  returning * into r;

  if not found then
    raise exception 'request_not_found';
  end if;

  return r;
end;
$$;

-- Generación atómica del reference_code (SOL-YYYY-####).
create sequence if not exists certificate_reference_seq start 1;

create or replace function public.next_reference_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n bigint;
begin
  n := nextval('certificate_reference_seq');
  return 'SOL-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 4, '0');
end;
$$;
