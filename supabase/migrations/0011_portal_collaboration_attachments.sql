-- ============================================================================
-- 0011: Colaboración del portal cliente
-- ============================================================================
-- - Adjuntos genéricos para decisiones, incidencias y visitas.
-- - Autoría en fotos de obra.
-- - Decisiones: cliente puede cambiar pendiente a aprobado/rechazado/aplazado.

create table if not exists expedition_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references certificate_requests(id) on delete cascade,
  entity_type text not null check (entity_type in ('decision', 'incident', 'site_visit')),
  entity_id uuid not null,
  storage_path text not null,
  original_filename text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references profiles(id) on delete set null,
  uploaded_by_role user_role not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_expedition_attachments_entity
  on expedition_attachments (entity_type, entity_id, created_at);

create index if not exists idx_expedition_attachments_request
  on expedition_attachments (request_id);

alter table expedition_attachments enable row level security;

drop policy if exists "Admin full access - expedition attachments" on expedition_attachments;
create policy "Admin full access - expedition attachments"
  on expedition_attachments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Client reads own visible expedition attachments" on expedition_attachments;
create policy "Client reads own visible expedition attachments"
  on expedition_attachments for select
  to authenticated
  using (
    exists (
      select 1 from certificate_requests cr
      where cr.id = expedition_attachments.request_id
        and cr.organization_id = public.user_org_id()
    )
    and (
      (
        entity_type = 'decision'
        and exists (
          select 1 from expedition_decisions d
          where d.id = expedition_attachments.entity_id
            and d.is_visible_to_client = true
        )
      )
      or (
        entity_type = 'incident'
        and exists (
          select 1 from expedition_incidents i
          where i.id = expedition_attachments.entity_id
            and i.is_visible_to_client = true
        )
      )
      or (
        entity_type = 'site_visit'
        and exists (
          select 1 from expedition_site_visits v
          where v.id = expedition_attachments.entity_id
            and v.is_visible_to_client = true
        )
      )
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expedition-attachments',
  'expedition-attachments',
  false,
  52428800,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf']
)
on conflict (id) do nothing;

drop policy if exists "Admin manage expedition-attachments" on storage.objects;
create policy "Admin manage expedition-attachments"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'expedition-attachments' and public.is_admin())
  with check (bucket_id = 'expedition-attachments' and public.is_admin());

drop policy if exists "Client reads own expedition-attachments" on storage.objects;
create policy "Client reads own expedition-attachments"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'expedition-attachments'
    and exists (
      select 1 from expedition_attachments ea
      join certificate_requests cr on cr.id = ea.request_id
      where ea.storage_path = storage.objects.name
        and cr.organization_id = public.user_org_id()
    )
  );

alter table expedition_photos
  add column if not exists uploaded_by uuid references profiles(id) on delete set null,
  add column if not exists uploaded_by_role user_role not null default 'admin';

drop policy if exists "Client inserts own visible photos" on expedition_photos;
create policy "Client inserts own visible photos"
  on expedition_photos for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and uploaded_by_role = 'client'
    and is_visible_to_client = true
    and exists (
      select 1 from certificate_requests cr
      where cr.id = expedition_photos.request_id
        and cr.organization_id = public.user_org_id()
    )
  );

drop policy if exists "Client uploads own expedition-photos" on storage.objects;
create policy "Client uploads own expedition-photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'expedition-photos'
    and (storage.foldername(name))[1] = public.user_org_id()::text
  );

drop policy if exists "Client creates own visible incidents" on expedition_incidents;
create policy "Client creates own visible incidents"
  on expedition_incidents for insert
  to authenticated
  with check (
    is_visible_to_client = true
    and status = 'open'
    and exists (
      select 1 from certificate_requests cr
      where cr.id = expedition_incidents.request_id
        and cr.organization_id = public.user_org_id()
    )
  );

drop policy if exists "Client responds to own decisions" on expedition_decisions;

create policy "Client responds to own decisions"
  on expedition_decisions for update
  to authenticated
  using (
    is_visible_to_client = true
    and status = 'pending'
    and exists (
      select 1 from certificate_requests cr
      join profiles p on p.organization_id = cr.organization_id
      where cr.id = expedition_decisions.request_id
        and p.id = auth.uid()
    )
  )
  with check (
    is_visible_to_client = true
    and status in ('approved', 'rejected', 'deferred')
    and exists (
      select 1 from certificate_requests cr
      join profiles p on p.organization_id = cr.organization_id
      where cr.id = expedition_decisions.request_id
        and p.id = auth.uid()
    )
  );

create or replace function public.prevent_client_decision_metadata_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;

  if
    new.id is distinct from old.id
    or new.request_id is distinct from old.request_id
    or new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.deadline is distinct from old.deadline
    or new.is_visible_to_client is distinct from old.is_visible_to_client
    or new.created_at is distinct from old.created_at
    or new.updated_at is distinct from old.updated_at
  then
    raise exception 'not_authorized';
  end if;

  if old.status <> 'pending' then
    raise exception 'invalid_status_transition';
  end if;

  if new.status not in ('approved', 'rejected', 'deferred') then
    raise exception 'invalid_status_transition';
  end if;

  return new;
end;
$$;
