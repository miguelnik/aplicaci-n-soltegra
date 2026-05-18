-- ============================================================
-- 0015: Atajo automático CRM ↔ Contabilidad
--   Cuando un proyecto se marca como pagado (is_paid = true),
--   todos los ingresos (finance_entries.kind = 'income') asociados
--   a ese proyecto que estén sin cobrar se marcan automáticamente
--   como cobrados.
--
--   Es asimétrico: desmarcar un proyecto NO desmarca los ingresos
--   (porque podrían haber sido marcados manualmente desde
--   contabilidad antes del cambio).
-- ============================================================

create or replace function sync_finance_settled_on_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo cuando is_paid pasa de false a true
  if NEW.is_paid is true
     and (OLD.is_paid is distinct from NEW.is_paid)
  then
    update finance_entries
       set is_settled = true,
           settled_at = coalesce(NEW.paid_at, now())
     where request_id = NEW.id
       and kind = 'income'
       and is_settled = false;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_sync_finance_settled on certificate_requests;

create trigger trg_sync_finance_settled
  after update of is_paid on certificate_requests
  for each row execute function sync_finance_settled_on_payment();

-- Aplicar a registros ya existentes (one-shot)
-- Marca como cobrados los ingresos pendientes ligados a proyectos ya pagados.
update finance_entries fe
   set is_settled = true,
       settled_at = coalesce(cr.paid_at, now())
  from certificate_requests cr
 where fe.request_id = cr.id
   and fe.kind = 'income'
   and fe.is_settled = false
   and cr.is_paid = true;
