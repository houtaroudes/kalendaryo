-- Kalendaryo schema.
--
-- Timestamps are stored without a time zone on purpose: the app works in one
-- business's local time, and the client sends and displays naive local stamps.
-- Using timestamptz here would silently shift every slot by the UTC offset.

create extension if not exists pgcrypto;

create table if not exists public.services (
  id text primary key,
  name text not null,
  blurb text not null default '',
  duration_minutes int not null check (duration_minutes > 0),
  price int not null default 0 check (price >= 0),
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.availability (
  id uuid primary key default gen_random_uuid(),
  weekday int not null check (weekday between 0 and 6),
  start text not null,
  finish text not null
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  service_id text references public.services(id),
  service_name text not null,
  starts_at timestamp not null,
  duration_minutes int not null check (duration_minutes > 0),
  price int not null default 0,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null default '',
  note text not null default '',
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

-- Two confirmed bookings can never share a start time, so a double booking
-- loses the race at the database rather than in the UI.
create unique index if not exists bookings_confirmed_slot
  on public.bookings (starts_at)
  where status = 'confirmed';

alter table public.services enable row level security;
alter table public.availability enable row level security;
alter table public.bookings enable row level security;

-- The menu and opening hours are public, changes need a signed-in owner.
drop policy if exists "services readable" on public.services;
create policy "services readable" on public.services for select using (true);
drop policy if exists "services owner writes" on public.services;
create policy "services owner writes" on public.services for all to authenticated using (true) with check (true);

drop policy if exists "availability readable" on public.availability;
create policy "availability readable" on public.availability for select using (true);
drop policy if exists "availability owner writes" on public.availability;
create policy "availability owner writes" on public.availability for all to authenticated using (true) with check (true);

-- Anyone may book, only the owner may read or change the book of business.
drop policy if exists "anyone may book" on public.bookings;
create policy "anyone may book" on public.bookings for insert to anon, authenticated with check (true);
drop policy if exists "owner reads bookings" on public.bookings;
create policy "owner reads bookings" on public.bookings for select to authenticated using (true);
drop policy if exists "owner updates bookings" on public.bookings;
create policy "owner updates bookings" on public.bookings for update to authenticated using (true) with check (true);

insert into public.services (id, name, blurb, duration_minutes, price, sort) values
  ('svc-cut', 'Signature cut', 'Consult, wash, cut and finish.', 45, 450, 1),
  ('svc-beard', 'Beard trim', 'Shape, line up and hot towel.', 30, 250, 2),
  ('svc-combo', 'Cut and beard', 'The full reset, both in one sitting.', 75, 650, 3),
  ('svc-color', 'Colour consult', 'Patch test, tone plan and pricing.', 30, 300, 4)
on conflict (id) do nothing;

insert into public.availability (weekday, start, finish) values
  (1, '09:00', '18:00'),
  (2, '09:00', '18:00'),
  (3, '09:00', '18:00'),
  (4, '09:00', '18:00'),
  (5, '09:00', '18:00'),
  (6, '09:00', '13:00')
on conflict do nothing;
