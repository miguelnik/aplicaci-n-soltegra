-- ============================================================================
-- 0024_ai_settings.sql
-- Configuración de IA: OpenAI, base de conocimiento, chat de asistente
-- comercial e inteligencia de cliente.
-- ============================================================================

-- ── 1. Columnas AI en company_settings ──────────────────────────────────────

alter table company_settings
  add column if not exists openai_api_key_encrypted text,
  add column if not exists openai_model text not null default 'gpt-4o-mini';

-- ── 2. Base de conocimiento (singleton) ─────────────────────────────────────

create table if not exists ai_knowledge_base (
  id          uuid primary key default gen_random_uuid(),
  content     text not null default '',
  updated_at  timestamptz not null default now(),
  updated_by  uuid references profiles(id) on delete set null
);

-- Insertar fila si no existe
insert into ai_knowledge_base (content)
  select '' where not exists (select 1 from ai_knowledge_base);

-- Trigger updated_at
create or replace function update_ai_kb_timestamp()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ai_kb_updated on ai_knowledge_base;
create trigger trg_ai_kb_updated
  before update on ai_knowledge_base
  for each row execute function update_ai_kb_timestamp();

alter table ai_knowledge_base enable row level security;

create policy "admin_read_kb" on ai_knowledge_base
  for select using (public.is_admin());

create policy "superadmin_write_kb" on ai_knowledge_base
  for update
  using (exists (select 1 from profiles where id = auth.uid() and role = 'superadmin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'superadmin'));

-- ── 3. Conversaciones del asistente comercial ───────────────────────────────

create table if not exists ai_chat_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  title       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_ai_chat_conv_user
  on ai_chat_conversations (user_id, updated_at desc);

create table if not exists ai_chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_chat_conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system')),
  content         text not null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_ai_chat_msg_conv
  on ai_chat_messages (conversation_id, created_at);

alter table ai_chat_conversations enable row level security;
alter table ai_chat_messages enable row level security;

-- Cada admin solo ve sus propias conversaciones
create policy "admin_own_conversations" on ai_chat_conversations
  for all
  using (public.is_admin() and user_id = auth.uid())
  with check (public.is_admin() and user_id = auth.uid());

create policy "admin_own_messages" on ai_chat_messages
  for all
  using (
    public.is_admin() and exists (
      select 1 from ai_chat_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  )
  with check (
    public.is_admin() and exists (
      select 1 from ai_chat_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

-- ── 4. Inteligencia de cliente ──────────────────────────────────────────────

create table if not exists ai_client_analyses (
  id              uuid primary key default gen_random_uuid(),
  opportunity_id  uuid references crm_opportunities(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  client_context  text,
  client_website  text,
  analysis_result text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references profiles(id) on delete set null,
  check (opportunity_id is not null or organization_id is not null)
);

create index if not exists idx_ai_analysis_opp
  on ai_client_analyses (opportunity_id) where opportunity_id is not null;
create index if not exists idx_ai_analysis_org
  on ai_client_analyses (organization_id) where organization_id is not null;

create table if not exists ai_client_chat_messages (
  id          uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references ai_client_analyses(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant', 'system')),
  content     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_ai_client_chat_analysis
  on ai_client_chat_messages (analysis_id, created_at);

alter table ai_client_analyses enable row level security;
alter table ai_client_chat_messages enable row level security;

-- Todos los admins pueden usar la inteligencia de cliente
create policy "admin_client_analyses" on ai_client_analyses
  for all using (public.is_admin()) with check (public.is_admin());

create policy "admin_client_chat" on ai_client_chat_messages
  for all using (public.is_admin()) with check (public.is_admin());
