-- ROAD core account data and row-level security.
-- Applied to project oinojqdxzyxurvrskhgs on 2026-11-11.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  locale text not null default 'ar' check (locale in ('ar','en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(preferences) = 'object'),
  risk_config jsonb not null default '{}'::jsonb check (jsonb_typeof(risk_config) = 'object'),
  updated_at timestamptz not null default now()
);
create table if not exists public.paper_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'ROAD Paper Account' check (char_length(name) between 1 and 80),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  initial_balance numeric(20,8) not null default 1000 check (initial_balance > 0),
  balance numeric(20,8) not null default 1000 check (balance >= 0),
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create table if not exists public.paper_trades (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z0-9._-]{2,24}$'),
  side text not null check (side in ('BUY','SELL')),
  quantity numeric(24,10) not null check (quantity > 0),
  entry_price numeric(24,10) not null check (entry_price > 0),
  stop_loss numeric(24,10),
  take_profit numeric(24,10),
  exit_price numeric(24,10),
  realized_pnl numeric(24,10),
  fees numeric(24,10) not null default 0 check (fees >= 0),
  status text not null default 'open' check (status in ('open','closed','cancelled')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  constraint paper_trade_account_owner_fk foreign key (account_id,user_id)
    references public.paper_accounts(id,user_id) on delete cascade
);
create index if not exists paper_trades_owner_opened_idx on public.paper_trades(user_id, opened_at desc);
create index if not exists paper_trades_account_status_idx on public.paper_trades(account_id, status);
create table if not exists public.mt5_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  account_type text not null check (account_type in ('DEMO','REAL')),
  login text not null check (char_length(login) between 1 and 40),
  server text not null check (char_length(server) between 1 and 120),
  connection_status text not null default 'not_connected'
    check (connection_status in ('not_connected','pending','connected','error','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id,user_id)
);
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  actor_role text not null default 'system' check (actor_role in ('admin','user','system')),
  action text not null check (char_length(action) between 1 and 120),
  resource_type text,
  resource_id text,
  outcome text not null default 'success' check (outcome in ('success','denied','failure')),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_user_created_idx on public.audit_logs(user_id, created_at desc);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);
create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function private.set_updated_at();
drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at before update on public.user_settings for each row execute function private.set_updated_at();
drop trigger if exists paper_accounts_set_updated_at on public.paper_accounts;
create trigger paper_accounts_set_updated_at before update on public.paper_accounts for each row execute function private.set_updated_at();
drop trigger if exists mt5_profiles_set_updated_at on public.mt5_profiles;
create trigger mt5_profiles_set_updated_at before update on public.mt5_profiles for each row execute function private.set_updated_at();
create or replace function private.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles(id, display_name) values (new.id, nullif(new.raw_user_meta_data ->> 'name','')) on conflict (id) do nothing;
  insert into public.user_settings(user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_road on auth.users;
create trigger on_auth_user_created_road after insert on auth.users for each row execute function private.handle_new_auth_user();
insert into public.profiles(id, display_name)
select id, nullif(raw_user_meta_data ->> 'name','') from auth.users on conflict (id) do nothing;
insert into public.user_settings(user_id) select id from auth.users on conflict (user_id) do nothing;
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.paper_accounts enable row level security;
alter table public.paper_trades enable row level security;
alter table public.mt5_profiles enable row level security;
alter table public.audit_logs enable row level security;
revoke all on public.profiles, public.user_settings, public.paper_accounts, public.paper_trades, public.mt5_profiles, public.audit_logs from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.user_settings to authenticated;
grant select, insert, update, delete on public.paper_accounts to authenticated;
grant select, insert, update, delete on public.paper_trades to authenticated;
grant select, insert, update, delete on public.mt5_profiles to authenticated;
grant select on public.audit_logs to authenticated;
create policy profiles_select_own on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_admin_read on public.profiles for select to authenticated using ((select private.has_role('admin')));
create policy user_settings_own on public.user_settings for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy paper_accounts_own on public.paper_accounts for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy paper_trades_own on public.paper_trades for all to authenticated
using (user_id = (select auth.uid()) and exists (select 1 from public.paper_accounts a where a.id = paper_trades.account_id and a.user_id = (select auth.uid())))
with check (user_id = (select auth.uid()) and exists (select 1 from public.paper_accounts a where a.id = paper_trades.account_id and a.user_id = (select auth.uid())));
create policy mt5_profiles_own on public.mt5_profiles for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy mt5_profiles_admin_read on public.mt5_profiles for select to authenticated using ((select private.has_role('admin')));
create policy audit_logs_read_own on public.audit_logs for select to authenticated using (user_id = (select auth.uid()));
create policy audit_logs_admin_read on public.audit_logs for select to authenticated using ((select private.has_role('admin')));
revoke insert, update, delete on public.user_roles from anon, authenticated;
revoke all on function private.handle_new_auth_user() from public, anon, authenticated;
revoke all on function private.set_updated_at() from public, anon, authenticated;
comment on table public.mt5_profiles is 'Metadata only. Never store broker passwords, investor passwords, access tokens, or cloud-provider secrets.';
comment on table public.audit_logs is 'Append-only audit events. Client roles have SELECT only; trusted server-side code writes audit records.';
