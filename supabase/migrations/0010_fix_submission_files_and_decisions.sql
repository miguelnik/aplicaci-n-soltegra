-- ============================================================================
-- 0010: Correcciones de envío, decisiones y endurecimiento de datos.
-- ============================================================================
-- - Restaura el registro de historial al enviar una solicitud.
-- - Restringe las actualizaciones de decisiones del cliente a su respuesta.

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

  if r.organization_id <> public.user_org_id() and not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  if r.status <> 'draft' then
    raise exception 'invalid_status_transition: % -> submitted', r.status;
  end if;

  update certificate_requests
  set
    status = 'submitted',
    reference_code = coalesce(reference_code, public.next_reference_code()),
    status_history = status_history || jsonb_build_array(
      jsonb_build_object('status', 'submitted', 'at', now())
    )
  where id = p_request_id
  returning * into r;

  return r;
end;
$$;

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
    and status = 'pending'
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
    or new.status is distinct from old.status
    or new.is_visible_to_client is distinct from old.is_visible_to_client
    or new.created_at is distinct from old.created_at
    or new.updated_at is distinct from old.updated_at
  then
    raise exception 'not_authorized';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_client_decision_metadata_update
  on expedition_decisions;

create trigger prevent_client_decision_metadata_update
before update on expedition_decisions
for each row execute function public.prevent_client_decision_metadata_update();
