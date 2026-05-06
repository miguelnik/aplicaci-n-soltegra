-- Fecha máxima de entrega solicitada por el cliente (opcional)
alter table certificate_requests
  add column if not exists client_deadline date;
