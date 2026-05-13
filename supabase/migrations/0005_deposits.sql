create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from admins where user_id = uid);
$$;

create table if not exists deposit_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_usd numeric not null check (amount_usd > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  user_note text,
  admin_note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists deposit_requests_status_idx on deposit_requests(status);
create index if not exists deposit_requests_user_idx on deposit_requests(user_id, created_at desc);

alter table admins enable row level security;
alter table deposit_requests enable row level security;

drop policy if exists "admins_self_read" on admins;
create policy "admins_self_read" on admins
  for select using (auth.uid() = user_id);

drop policy if exists "deposit_select_own_or_admin" on deposit_requests;
create policy "deposit_select_own_or_admin" on deposit_requests
  for select using (
    auth.uid() = user_id or is_admin(auth.uid())
  );

drop policy if exists "deposit_insert_own_pending" on deposit_requests;
create policy "deposit_insert_own_pending" on deposit_requests
  for insert with check (
    auth.uid() = user_id and status = 'pending'
  );

alter publication supabase_realtime add table deposit_requests;
