create table if not exists watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chain text not null,
  pair_address text not null,
  token_symbol text,
  token_name text,
  created_at timestamptz not null default now(),
  unique (user_id, chain, pair_address)
);

create index if not exists watchlist_user_id_idx on watchlist(user_id);

create table if not exists tracked_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_address text not null,
  label text,
  created_at timestamptz not null default now(),
  unique (user_id, wallet_address)
);

create index if not exists tracked_wallets_user_id_idx on tracked_wallets(user_id);

alter table watchlist enable row level security;
alter table tracked_wallets enable row level security;

create policy "watchlist_select_own" on watchlist
  for select using (auth.uid() = user_id);

create policy "watchlist_insert_own" on watchlist
  for insert with check (auth.uid() = user_id);

create policy "watchlist_delete_own" on watchlist
  for delete using (auth.uid() = user_id);

create policy "tracked_wallets_select_own" on tracked_wallets
  for select using (auth.uid() = user_id);

create policy "tracked_wallets_insert_own" on tracked_wallets
  for insert with check (auth.uid() = user_id);

create policy "tracked_wallets_update_own" on tracked_wallets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "tracked_wallets_delete_own" on tracked_wallets
  for delete using (auth.uid() = user_id);
