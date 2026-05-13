alter table watchlist add column if not exists min_usd numeric;
alter table watchlist add column if not exists active boolean not null default true;

alter table tracked_wallets add column if not exists min_usd numeric;
alter table tracked_wallets add column if not exists active boolean not null default true;

drop policy if exists "watchlist_update_own" on watchlist;
create policy "watchlist_update_own" on watchlist
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists tracked_wallets_active_idx on tracked_wallets(active) where active;
create index if not exists watchlist_active_idx on watchlist(active) where active;

alter publication supabase_realtime add table watchlist;
alter publication supabase_realtime add table tracked_wallets;
