-- ============================================================
-- 0022: Campo "Ubicación del proyecto" en presupuestos
-- ============================================================

alter table budgets
  add column if not exists project_location text;
