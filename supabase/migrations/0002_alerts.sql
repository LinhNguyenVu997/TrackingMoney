create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  chain text,
  pair_address text,
  payload jsonb not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists alerts_user_created_idx on alerts(user_id, created_at desc);

create table if not exists alert_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  params jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists alert_rules_active_idx on alert_rules(active) where active;

create table if not exists telegram_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  chat_id text not null unique,
  linked_at timestamptz not null default now()
);

create table if not exists telegram_link_codes (
  code text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists telegram_link_codes_user_idx on telegram_link_codes(user_id);

alter table alerts enable row level security;
alter table alert_rules enable row level security;
alter table telegram_links enable row level security;
alter table telegram_link_codes enable row level security;

create policy "alerts_select_own" on alerts
  for select using (auth.uid() = user_id);

create policy "alerts_update_own" on alerts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "alerts_delete_own" on alerts
  for delete using (auth.uid() = user_id);

create policy "alert_rules_all_own" on alert_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "telegram_links_select_own" on telegram_links
  for select using (auth.uid() = user_id);

create policy "telegram_links_delete_own" on telegram_links
  for delete using (auth.uid() = user_id);

create policy "telegram_link_codes_insert_own" on telegram_link_codes
  for insert with check (auth.uid() = user_id);

create policy "telegram_link_codes_select_own" on telegram_link_codes
  for select using (auth.uid() = user_id);

alter publication supabase_realtime add table alerts;
