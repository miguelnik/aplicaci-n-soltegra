-- =====================================================================
-- Multi-servicio: la plataforma soporta múltiples tipos de servicio
-- (certificados energéticos + otros estudios de ingeniería).
-- Cada servicio tiene su propio formulario versionado independiente.
-- =====================================================================

-- 1) Tabla de tipos de servicio
create table if not exists service_types (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  icon text default 'FileText',
  is_active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_service_types_active_order on service_types (is_active, display_order);

alter table service_types enable row level security;

-- Cualquier usuario autenticado puede leer servicios activos.
-- Admins pueden ver también los inactivos.
drop policy if exists service_types_select on service_types;
create policy service_types_select on service_types for select
  using (auth.role() = 'authenticated' and (is_active = true or public.is_admin()));

drop policy if exists service_types_admin_all on service_types;
create policy service_types_admin_all on service_types for all
  using (public.is_admin())
  with check (public.is_admin());

-- 2) Crear servicio inicial: certificado energético
insert into service_types (slug, name, description, icon, display_order)
values (
  'certificado-energetico',
  'Certificado energético',
  'Certificación energética de viviendas y locales',
  'Zap',
  0
)
on conflict (slug) do nothing;

-- 3) Añadir service_type_id a form_schemas
alter table form_schemas
  add column if not exists service_type_id uuid references service_types(id) on delete cascade;

-- Asignar todos los schemas existentes al servicio "certificado-energetico"
update form_schemas
set service_type_id = (select id from service_types where slug = 'certificado-energetico')
where service_type_id is null;

-- Hacer obligatorio
alter table form_schemas alter column service_type_id set not null;

-- Cambiar índice único: is_current debe ser único POR servicio, no global
drop index if exists form_schemas_one_current;
create unique index if not exists form_schemas_current_per_service
  on form_schemas (service_type_id) where is_current = true;

-- También: la constraint UNIQUE en (version) debe ser por servicio, no global,
-- para que cada servicio pueda tener su propia versión 1, 2, 3...
alter table form_schemas drop constraint if exists form_schemas_version_key;
alter table form_schemas
  add constraint form_schemas_version_per_service_key unique (service_type_id, version);

-- 4) Añadir service_type_id a certificate_requests
alter table certificate_requests
  add column if not exists service_type_id uuid references service_types(id);

update certificate_requests
set service_type_id = (select id from service_types where slug = 'certificado-energetico')
where service_type_id is null;

alter table certificate_requests alter column service_type_id set not null;

create index if not exists idx_certificate_requests_service on certificate_requests (service_type_id);

-- 5) Notas públicas para el cliente (visibles desde el detalle de solicitud)
alter table certificate_requests
  add column if not exists client_notes text;

-- 6) Trigger para mantener updated_at en service_types
drop trigger if exists service_types_updated_at on service_types;
create trigger service_types_updated_at
before update on service_types
for each row execute function set_updated_at();
