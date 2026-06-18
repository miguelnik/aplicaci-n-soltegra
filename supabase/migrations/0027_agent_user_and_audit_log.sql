-- ============================================================
-- 0027: Usuario "Agente IA" + tabla de auditoría de tools MCP
--
-- Crea un usuario admin sintético que representa al agente de IA
-- (Telegram bot conectado vía MCP) en el CRM. Todas las acciones
-- del bot quedan trazadas con este user_id como created_by, owner_id,
-- etc., para que en la UI puedas distinguir "esto lo hizo el bot" de
-- "esto lo hizo un humano".
--
-- También crea la tabla agent_audit_log donde el servidor MCP
-- registra cada tool call (nombre, args, resultado, duración).
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Usuario Agente IA en auth.users + perfil admin
-- ─────────────────────────────────────────────────────────────
-- UUID fijo conocido para poder referenciarlo desde código sin
-- tener que leer la DB. Si cambia este valor, actualizar
-- lib/mcp/constants.ts.
do $$
declare
  agent_id constant uuid := '00000000-0000-0000-0000-000000a1a1a1';
begin
  -- auth.users — Supabase normalmente se rellena vía la Admin API.
  -- Aquí lo insertamos directamente porque el agente no necesita
  -- login real (nunca inicia sesión). Email único y placeholder.
  if not exists (select 1 from auth.users where id = agent_id) then
    insert into auth.users (
      id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, is_super_admin,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      agent_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'agente-ia@soltegra.internal',
      crypt(gen_random_uuid()::text, gen_salt('bf')),  -- password random no usable
      now(),
      jsonb_build_object('provider', 'internal', 'providers', jsonb_build_array('internal')),
      jsonb_build_object('full_name', 'Agente IA', 'is_agent', true),
      now(),
      now(),
      false,
      '', '', '', ''
    );
  end if;

  -- Perfil admin. organization_id null por el constraint profiles_admin_no_org.
  if not exists (select 1 from profiles where id = agent_id) then
    insert into profiles (id, role, full_name, organization_id)
    values (agent_id, 'admin', 'Agente IA', null);
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 2. Tabla de auditoría de tool calls del MCP server
-- ─────────────────────────────────────────────────────────────
create table if not exists agent_audit_log (
  id              uuid primary key default gen_random_uuid(),
  agent_id        uuid references profiles(id) on delete set null,
  tool_name       text not null,
  args            jsonb,
  -- Solo guardamos el resumen del resultado (ok/error + mensaje corto)
  -- para no inflar la tabla con dumps masivos.
  result_status   text not null check (result_status in ('ok', 'error', 'dry_run')),
  result_summary  text,
  error_message   text,
  duration_ms     int,
  -- Idempotencia opcional (para tools que reciben request_id externo).
  request_id      text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_agent_audit_tool   on agent_audit_log (tool_name, created_at desc);
create index if not exists idx_agent_audit_status on agent_audit_log (result_status, created_at desc);
create index if not exists idx_agent_audit_agent  on agent_audit_log (agent_id, created_at desc);

-- RLS — solo admin/superadmin leen el log; nadie lo modifica desde RLS.
-- (El servidor MCP usa service_role y bypassa RLS para insertar.)
alter table agent_audit_log enable row level security;
create policy "admin_read_agent_audit" on agent_audit_log
  for select using (public.is_admin());
