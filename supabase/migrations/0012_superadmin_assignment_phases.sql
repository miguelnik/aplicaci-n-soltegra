-- ============================================================================
-- 0012: Superadministrador, asignación de solicitudes y fases configurables
-- ============================================================================

-- 1. Añadir valor 'superadmin' al enum user_role
--    (ALTER TYPE ADD VALUE no puede ejecutarse dentro de una transacción)
alter type user_role add value if not exists 'superadmin';

-- ============================================================================
-- 2. Actualizar la constraint de perfiles para incluir superadmin
-- ============================================================================
alter table profiles drop constraint if exists profiles_admin_no_org;

alter table profiles add constraint profiles_admin_no_org check (
  (role in ('admin', 'superadmin') and organization_id is null)
  or
  (role = 'client' and organization_id is not null)
);

-- ============================================================================
-- 3. Función is_superadmin()
-- ============================================================================
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'superadmin'
  );
$$;

-- ============================================================================
-- 4. Actualizar is_admin() para que superadmins también sean "admin"
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
    where id = auth.uid() and role in ('admin', 'superadmin')
  );
$$;

-- ============================================================================
-- 5. Asignación de solicitudes a trabajadores
-- ============================================================================
alter table certificate_requests
  add column if not exists assigned_to uuid references profiles(id) on delete set null;

create index if not exists certificate_requests_assigned_to_idx
  on certificate_requests (assigned_to);

-- ============================================================================
-- 6. Fases configurables del proyecto por tipo de servicio
-- ============================================================================
alter table service_types
  add column if not exists status_phases jsonb not null default '[]'::jsonb;

-- Fase actual en la solicitud (key de la fase activa)
alter table certificate_requests
  add column if not exists current_phase_key text;

-- ============================================================================
-- 7. Políticas RLS: solo superadmin puede eliminar admins
-- ============================================================================

-- Política de delete en profiles: superadmin puede borrar cualquiera,
-- admin solo puede borrar clientes (no admins ni superadmins).
drop policy if exists "Superadmin deletes any profile" on profiles;
create policy "Superadmin deletes any profile"
  on profiles for delete
  to authenticated
  using (public.is_superadmin());

-- Admin normal puede borrar solo perfiles de cliente
drop policy if exists "Admin deletes client profiles only" on profiles;
create policy "Admin deletes client profiles only"
  on profiles for delete
  to authenticated
  using (
    public.is_admin()
    and not public.is_superadmin()
    and (select role from profiles where id = profiles.id) = 'client'
  );
