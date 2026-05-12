-- ============================================================================
-- 0008: Sistema de módulos configurables por tipo de servicio
-- + Tabla genérica de documentos de expediente
-- ============================================================================
-- Convierte la plataforma en un portal modular por tipo de servicio.
-- Los certificados energéticos siguen funcionando exactamente igual:
-- si un servicio no tiene module_config, se usa la configuración fallback.
-- ============================================================================

-- 1) Columna module_config en service_types
--    JSONB: array de ModuleConfig (ver lib/modules/types.ts)
--    NULL significa "usa la configuración por defecto del código"
alter table service_types
  add column if not exists module_config jsonb default null;

-- Comentario de referencia:
-- Estructura esperada de module_config:
-- [
--   {
--     "key": "status_timeline",        -- ModuleKey del catálogo
--     "label": "Estado",               -- Nombre visible en el portal
--     "is_active": true,               -- Módulo activo para este servicio
--     "visible_to": "both",            -- "client" | "admin" | "both"
--     "order": 0,                      -- Posición en la pantalla (ascendente)
--     "description": "...",            -- Descripción interna (opcional)
--     "config": {}                     -- Config específica del módulo (futuro)
--   },
--   ...
-- ]

-- 2) Tabla genérica de documentos por expediente
--    Complementa (no reemplaza) request_files y certificate_pdf_path.
--    Los entregables y documentación de proyectos de ingeniería van aquí.
create table if not exists expedition_documents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references certificate_requests(id) on delete cascade,

  -- Categoría del documento
  -- 'deliverable'     → entregable final para el cliente (plano, memoria, certificado...)
  -- 'admin_document'  → documentación interna de Soltegra (no visible al cliente por defecto)
  -- 'client_document' → documento aportado por el cliente fuera del formulario inicial
  category text not null check (category in ('deliverable', 'admin_document', 'client_document')),

  label text not null,                  -- Nombre visible del documento
  storage_path text not null,           -- Ruta en bucket 'expedition-docs'
  original_filename text not null,
  mime_type text,
  size_bytes bigint,

  -- Controla si el cliente puede ver este documento en su portal
  is_visible_to_client boolean not null default true,

  uploaded_by uuid references profiles(id) on delete set null,
  uploaded_at timestamptz not null default now(),

  -- Notas internas visibles solo al admin
  internal_notes text
);

create index if not exists idx_expedition_documents_request
  on expedition_documents (request_id, category);

create index if not exists idx_expedition_documents_request_visible
  on expedition_documents (request_id, is_visible_to_client)
  where is_visible_to_client = true;

alter table expedition_documents enable row level security;

-- Cliente: solo lee documentos marcados como visibles de su organización
create policy "expedition_docs_client_read"
  on expedition_documents for select
  using (
    is_visible_to_client = true
    and exists (
      select 1 from certificate_requests cr
      where cr.id = expedition_documents.request_id
        and cr.organization_id = public.user_org_id()
    )
  );

-- Admin: gestión completa
create policy "expedition_docs_admin_all"
  on expedition_documents for all
  using (public.is_admin())
  with check (public.is_admin());

-- 3) Bucket 'expedition-docs' para los documentos de expediente
--    Separado de 'request-uploads' (formulario inicial) y 'certificates' (PDF cert. energético)
insert into storage.buckets (id, name, public)
values ('expedition-docs', 'expedition-docs', false)
on conflict (id) do nothing;

-- Path esperado: expedition-docs/{organization_id}/{request_id}/{uuid}-{filename}

create policy "expedition_docs_storage_select"
  on storage.objects for select
  using (
    bucket_id = 'expedition-docs'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = public.user_org_id()::text
    )
  );

create policy "expedition_docs_storage_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'expedition-docs'
    and public.is_admin()
  );

create policy "expedition_docs_storage_update"
  on storage.objects for update
  using (bucket_id = 'expedition-docs' and public.is_admin())
  with check (bucket_id = 'expedition-docs' and public.is_admin());

create policy "expedition_docs_storage_delete"
  on storage.objects for delete
  using (bucket_id = 'expedition-docs' and public.is_admin());

-- 4) Trigger updated_at para service_types (ya existía pero reforzamos)
-- (El trigger service_types_updated_at ya fue creado en 0005_multi_service.sql)
