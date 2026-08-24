-- Resource Booking System — Supabase schema
-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query).
-- Safe to re-run: uses IF NOT EXISTS / drop-and-recreate for policies.

-- ---------- Tables ----------

create table if not exists groups (
  id text primary key,
  name text not null
);

create table if not exists resources (
  id text primary key,
  name text not null,
  group_id text references groups(id) on delete cascade,
  slots int not null default 1,
  capacity int,
  requires_approval boolean not null default false
);

create table if not exists periods (
  id text primary key,
  group_id text references groups(id) on delete cascade,
  label text not null,
  type text not null default 'period', -- 'period' | 'break'
  start_time text not null,            -- "HH:MM"
  end_time text not null,              -- "HH:MM"
  sort_order int not null default 0
);

create table if not exists app_users (
  id text primary key,
  name text not null unique,
  role text not null default 'user'    -- 'user' | 'admin'
);

create table if not exists bookings (
  id text primary key,
  resource_id text references resources(id) on delete cascade,
  period_id text,                      -- null when all_day = true
  all_day boolean not null default false,
  date date not null,
  title text not null,
  booked_by_id text references app_users(id),
  booked_by text not null,
  status text not null default 'confirmed', -- 'confirmed' | 'pending'
  recurrence_id text,                  -- shared id across occurrences of one recurring request
  group_id text references groups(id), -- which group's timetable this booking's period_id belongs to
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id text primary key,
  user_id text references app_users(id) on delete cascade,
  type text not null,                  -- 'approved' | 'rejected'
  message text not null,
  created_at timestamptz not null default now()
);

-- The audit log: one row per booking lifecycle event. This is what gives you
-- real "who did what, when" history — separate from the current-state tables above.
create table if not exists booking_events (
  id bigint generated always as identity primary key,
  booking_id text not null,
  action text not null,                -- 'created' | 'approved' | 'rejected' | 'cancelled' | 'series_approved' | 'series_rejected' | 'series_cancelled'
  actor text not null,                 -- name of the user who performed the action
  actor_id text,
  details jsonb,                       -- freeform: resource name, date, period, title, etc.
  created_at timestamptz not null default now()
);

create index if not exists idx_booking_events_booking_id on booking_events(booking_id);
create index if not exists idx_bookings_resource_date on bookings(resource_id, date);
create index if not exists idx_bookings_status on bookings(status);

-- ---------- Row Level Security ----------
-- This app authenticates by name-matching against app_users rather than
-- Supabase Auth, so there is no real per-request identity to check server-side.
-- The policies below are intentionally PERMISSIVE (any anon key can read/write)
-- so the app works out of the box. This is fine for an internal/trusted-network
-- tool but is NOT safe for a public-internet deployment with sensitive data.
-- See DEPLOYMENT.md "Next steps: real authentication" for how to lock this down
-- with Supabase Auth once you're ready.

alter table groups enable row level security;
alter table resources enable row level security;
alter table periods enable row level security;
alter table app_users enable row level security;
alter table bookings enable row level security;
alter table notifications enable row level security;
alter table booking_events enable row level security;

drop policy if exists "public full access" on groups;
create policy "public full access" on groups for all using (true) with check (true);

drop policy if exists "public full access" on resources;
create policy "public full access" on resources for all using (true) with check (true);

drop policy if exists "public full access" on periods;
create policy "public full access" on periods for all using (true) with check (true);

drop policy if exists "public full access" on app_users;
create policy "public full access" on app_users for all using (true) with check (true);

drop policy if exists "public full access" on bookings;
create policy "public full access" on bookings for all using (true) with check (true);

drop policy if exists "public full access" on notifications;
create policy "public full access" on notifications for all using (true) with check (true);

drop policy if exists "public full access" on booking_events;
create policy "public full access" on booking_events for all using (true) with check (true);

-- ---------- Seed data ----------
-- Matches the app's built-in defaults so the first run isn't empty.

insert into groups (id, name) values
  ('g1', 'Large Venues'),
  ('g2', 'Meeting Rooms'),
  ('g3', 'Classrooms'),
  ('g4', 'Outdoor Locations'),
  ('g5', 'ICT Resources')
on conflict (id) do nothing;

insert into resources (id, name, group_id, slots, capacity, requires_approval) values
  ('r1', 'Hall Court 1', 'g1', 1, 200, true),
  ('r2', 'Hall Court 2', 'g1', 1, 150, true),
  ('r3', 'Hall Hermitage', 'g1', 1, 60, false),
  ('r4', 'Theatre', 'g1', 1, 300, true),
  ('r5', 'LaValla', 'g1', 1, 40, false),
  ('r6', 'Chapel', 'g1', 1, 120, true),
  ('r7', 'Meeting Room A', 'g2', 2, 10, false),
  ('r8', 'Meeting Room B', 'g2', 1, 6, false),
  ('r9', 'Room 101', 'g3', 1, 30, false),
  ('r10', 'Room 204', 'g3', 1, 28, false),
  ('r11', 'Sports Oval', 'g4', 1, 500, true),
  ('r12', 'Laptop Trolley', 'g5', 3, null, false)
on conflict (id) do nothing;

insert into periods (id, group_id, label, type, start_time, end_time, sort_order) values
  ('morning', 'g1', 'Morning', 'break', '08:00', '08:20', 0),
  ('homeroom', 'g1', 'Homeroom', 'period', '08:20', '08:35', 1),
  ('p1', 'g1', 'Period 1', 'period', '08:40', '09:30', 2),
  ('p2', 'g1', 'Period 2', 'period', '09:35', '10:25', 3),
  ('recess', 'g1', 'Recess', 'break', '10:25', '10:45', 4),
  ('p3', 'g1', 'Period 3', 'period', '10:45', '11:35', 5),
  ('p4', 'g1', 'Period 4', 'period', '11:40', '12:30', 6),
  ('lunch', 'g1', 'Lunch', 'break', '12:30', '13:15', 7),
  ('p5', 'g1', 'Period 5', 'period', '13:15', '14:05', 8),
  ('p6', 'g1', 'Period 6', 'period', '14:10', '15:00', 9),
  ('h9', 'g2', '9–10am', 'period', '09:00', '10:00', 0),
  ('h10', 'g2', '10–11am', 'period', '10:00', '11:00', 1),
  ('h11', 'g2', '11am–12pm', 'period', '11:00', '12:00', 2),
  ('hlunch', 'g2', 'Lunch', 'break', '12:00', '13:00', 3),
  ('h13', 'g2', '1–2pm', 'period', '13:00', '14:00', 4),
  ('h14', 'g2', '2–3pm', 'period', '14:00', '15:00', 5),
  ('h15', 'g2', '3–4pm', 'period', '15:00', '16:00', 6)
on conflict (id) do nothing;

insert into app_users (id, name, role) values
  ('u1', 'A. Marsh', 'admin'),
  ('u2', 'Julie Stewart', 'user'),
  ('u3', 'Barry Graham', 'user'),
  ('u4', 'Trudy Sawyer', 'user')
on conflict (id) do nothing;
