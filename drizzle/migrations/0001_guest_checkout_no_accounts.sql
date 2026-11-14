
drop trigger if exists on_auth_user_created on auth.users;

drop policy if exists "Admins update menu" on public.menu_items;
revoke update on public.menu_items from authenticated;

drop policy if exists "Users view own orders" on public.orders;
drop policy if exists "Admins view all orders" on public.orders;
drop policy if exists "Admins update orders" on public.orders;
revoke select, update on public.orders from authenticated;
alter publication supabase_realtime drop table public.orders;

drop policy if exists "Admins view logs" on public.admin_logs;
drop policy if exists "Admins write logs" on public.admin_logs;
revoke select, insert on public.admin_logs from authenticated;
alter table public.admin_logs alter column admin_id drop not null;

comment on table public.profiles is 'DEPRECATED: customer accounts removed; replaced by public.guests';
comment on table public.user_roles is 'DEPRECATED: staff access now uses a passcode';

create table public.guests (
  id uuid primary key,
  points integer not null default 0 check (points >= 0),
  lifetime_points integer not null default 0,
  created_at timestamptz not null default now()
);
grant all on public.guests to service_role;
alter table public.guests enable row level security;

alter table public.orders alter column user_id drop not null;
comment on column public.orders.user_id is 'DEPRECATED: replaced by guest_id';
alter table public.orders add column guest_id uuid;
create index orders_guest_idx on public.orders (guest_id, created_at desc);
