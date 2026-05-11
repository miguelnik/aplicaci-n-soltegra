-- Añade dirección de facturación a la tabla de organizaciones
alter table organizations
  add column if not exists billing_address text default null;
