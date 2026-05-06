-- Añade columna para historial de estados (timeline visual)
alter table certificate_requests
  add column if not exists status_history jsonb not null default '[]'::jsonb;

-- Cuando submit_request cambia a submitted, registrar en historial
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
    status_history = status_history || jsonb_build_array(jsonb_build_object('status', 'submitted', 'at', now()))
  where id = p_request_id
  returning * into r;

  return r;
end;
$$;

-- Cuando admin cambia estado, registrar en historial
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
    delivered_at = case when p_new_status = 'delivered' and delivered_at is null then now() else delivered_at end,
    status_history = status_history || jsonb_build_array(jsonb_build_object('status', p_new_status::text, 'at', now()))
  where id = p_request_id
  returning * into r;

  if not found then
    raise exception 'request_not_found';
  end if;

  return r;
end;
$$;
