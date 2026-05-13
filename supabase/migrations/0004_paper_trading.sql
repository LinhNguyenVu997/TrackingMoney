create table if not exists paper_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  starting_balance numeric not null default 1000,
  position_size_usd numeric not null default 50,
  stop_loss_pct numeric not null default 20,
  take_profit_pct numeric not null default 50,
  max_hold_hours int not null default 24,
  follow_whale_buy boolean not null default true,
  follow_cluster_buy boolean not null default true,
  follow_wallet_activity boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists paper_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chain text not null,
  pair_address text not null,
  token_symbol text,
  signal_kind text not null,
  entry_price numeric not null,
  entry_amount_usd numeric not null,
  entry_tokens numeric not null,
  entry_at timestamptz not null default now(),
  exit_price numeric,
  exit_at timestamptz,
  exit_reason text,
  pnl_usd numeric,
  pnl_pct numeric,
  status text not null default 'open',
  alert_id uuid references alerts(id) on delete set null
);

create index if not exists paper_trades_user_status_idx on paper_trades(user_id, status);
create index if not exists paper_trades_user_entry_idx on paper_trades(user_id, entry_at desc);
create index if not exists paper_trades_open_idx on paper_trades(status) where status = 'open';

alter table paper_settings enable row level security;
alter table paper_trades enable row level security;

create policy "paper_settings_all_own" on paper_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "paper_trades_select_own" on paper_trades
  for select using (auth.uid() = user_id);

create policy "paper_trades_delete_own" on paper_trades
  for delete using (auth.uid() = user_id);

alter publication supabase_realtime add table paper_trades;
