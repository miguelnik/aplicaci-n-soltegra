-- Actualiza submit_request para generar el reference_code al enviar.
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
    reference_code = public.next_reference_code()
  where id = p_request_id
  returning * into r;

  return r;
end;
$$;

-- Backfill: asigna referencia a solicitudes ya enviadas que no tienen código.
update certificate_requests
set reference_code = public.next_reference_code()
where reference_code is null
  and status <> 'draft';
