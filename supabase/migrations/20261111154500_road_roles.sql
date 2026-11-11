-- ROAD role and authorization foundation.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','user')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);
alter table public.user_roles enable row level security;
revoke all on public.user_roles from anon, authenticated;
grant select on public.user_roles to authenticated;

create or replace function private.has_role(_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.role = _role
  );
$$;
revoke all on function private.has_role(text) from public, anon;
grant execute on function private.has_role(text) to authenticated;

create policy "Users can read their own roles"
on public.user_roles for select to authenticated
using (user_id = (select auth.uid()));

create policy "Admins can read all roles"
on public.user_roles for select to authenticated
using ((select private.has_role('admin')));

revoke insert, update, delete on public.user_roles from anon, authenticated;
