-- ============================================================
-- 0017: Simplificación del overhead
--
-- Cambio de diseño: en vez de marcar un proyecto certificate_requests
-- como overhead (que requería crear un proyecto fake con cliente y
-- servicio inventados), tratamos las horas SIN proyecto (request_id null)
-- como overhead automáticamente. Más limpio, sin entidad fantasma.
-- ============================================================

drop trigger if exists trg_auto_hide_overhead on certificate_requests;
drop function if exists auto_hide_overhead_projects();
drop index if exists idx_requests_overhead;

alter table certificate_requests
  drop column if exists is_general_overhead;
