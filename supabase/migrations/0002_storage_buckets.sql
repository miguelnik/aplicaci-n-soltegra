-- ============================================================================
-- Buckets de Supabase Storage y políticas RLS asociadas.
-- ============================================================================

insert into storage.buckets (id, name, public)
values
  ('request-uploads', 'request-uploads', false),
  ('certificates', 'certificates', false)
on conflict (id) do nothing;

-- Estructura de paths (impuesta a nivel de aplicación):
--   request-uploads/{organization_id}/{request_id}/{field_key}/{uuid}-{filename}
--   certificates/{organization_id}/{request_id}/certificado-{reference_code}.pdf
--
-- (storage.foldername(name))[1] devuelve la primera carpeta = organization_id.

-- ---------- request-uploads ----------
create policy "request_uploads_select_own_org"
  on storage.objects for select
  using (
    bucket_id = 'request-uploads'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = public.user_org_id()::text
    )
  );

create policy "request_uploads_insert_own_org"
  on storage.objects for insert
  with check (
    bucket_id = 'request-uploads'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = public.user_org_id()::text
    )
  );

create policy "request_uploads_delete_own_org"
  on storage.objects for delete
  using (
    bucket_id = 'request-uploads'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = public.user_org_id()::text
    )
  );

-- ---------- certificates ----------
-- Cliente solo lectura; subida y borrado solo admin.
create policy "certificates_select_own_org"
  on storage.objects for select
  using (
    bucket_id = 'certificates'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = public.user_org_id()::text
    )
  );

create policy "certificates_admin_write"
  on storage.objects for insert
  with check (
    bucket_id = 'certificates' and public.is_admin()
  );

create policy "certificates_admin_update"
  on storage.objects for update
  using (bucket_id = 'certificates' and public.is_admin())
  with check (bucket_id = 'certificates' and public.is_admin());

create policy "certificates_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'certificates' and public.is_admin());
