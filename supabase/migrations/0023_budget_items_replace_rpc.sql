-- ============================================================================
-- 0023_budget_items_replace_rpc.sql
-- RPCs atómicas para reemplazar líneas de presupuesto y de plantilla.
-- Sustituyen el patrón delete-then-insert que dejaba la cabecera huérfana si
-- el insert fallaba a mitad.
-- ============================================================================

create or replace function public.replace_budget_items(
  p_budget_id uuid,
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from budget_items where budget_id = p_budget_id;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) > 0 then
    insert into budget_items (
      budget_id, position, concept, description, quantity, unit, unit_price, discount_pct
    )
    select
      p_budget_id,
      (row_number() over () - 1)::int as position,
      (elem->>'concept'),
      nullif(elem->>'description', ''),
      (elem->>'quantity')::numeric,
      coalesce(nullif(elem->>'unit', ''), 'ud'),
      (elem->>'unit_price')::numeric,
      coalesce((elem->>'discount_pct')::numeric, 0)
    from jsonb_array_elements(p_items) as elem;
  end if;
end;
$$;

create or replace function public.replace_budget_template_items(
  p_template_id uuid,
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from budget_template_items where template_id = p_template_id;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) > 0 then
    insert into budget_template_items (
      template_id, position, concept, description, quantity, unit, unit_price, discount_pct
    )
    select
      p_template_id,
      (row_number() over () - 1)::int as position,
      (elem->>'concept'),
      nullif(elem->>'description', ''),
      (elem->>'quantity')::numeric,
      coalesce(nullif(elem->>'unit', ''), 'ud'),
      (elem->>'unit_price')::numeric,
      coalesce((elem->>'discount_pct')::numeric, 0)
    from jsonb_array_elements(p_items) as elem;
  end if;
end;
$$;

-- Limitar la ejecución al service_role (las server actions usan admin client).
revoke all on function public.replace_budget_items(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.replace_budget_template_items(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_budget_items(uuid, jsonb) to service_role;
grant execute on function public.replace_budget_template_items(uuid, jsonb) to service_role;
