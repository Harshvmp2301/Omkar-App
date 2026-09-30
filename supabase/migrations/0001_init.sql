-- ══════════════════════════════════════════════════════════════════════════
--  OMKAR APP — DATABASE SCHEMA (Supabase / PostgreSQL)
-- ══════════════════════════════════════════════════════════════════════════
--
--  HOW TO RUN
--    Supabase dashboard → your project → SQL Editor → New query →
--    paste this whole file → Run.
--
--    It is written to be SAFE TO RE-RUN: every object is created only if it
--    does not already exist, and every policy is dropped and recreated. If
--    you run it twice you get the same result, not an error.
--
--  WHAT IT CREATES
--    seva_signups   every seva (volunteer) form submission
--    messages       every "send a message" submission
--    events         programs the admin can edit without touching code
--    photos         gallery photos, with the image in Supabase Storage
--    admins         the allowlist of people who may open the dashboard
--
--  SECURITY MODEL (the important part)
--    Row Level Security is ON for every table. The public website can only
--    INSERT into the form tables — it can never read them back. Only
--    allow-listed admins can read or change anything. The "anon" key that
--    ships in the website is therefore safe to expose: even if someone
--    copies it out of the page, the database refuses to show them your
--    seva signups, messages or photos.
--
--    NOTE: there is deliberately NO donations table. Omkar Samithi does not
--    accept donations; the site has no donation form and stores no amounts.
--
-- ══════════════════════════════════════════════════════════════════════════

-- gen_random_uuid() lives in pgcrypto, which Supabase already ships.
create extension if not exists pgcrypto;


-- ─────────────────────────────────────────────────────────────── 1. admins ──
-- Who may open the admin dashboard. There is NO public sign-up: you add an
-- address here yourself (see the example at the very bottom of this file),
-- and a Google sign-in with that address is accepted.
create table if not exists public.admins (
  email      text primary key,
  note       text,
  created_at timestamptz not null default now()
);

-- Is the person making this request an allow-listed admin?
-- SECURITY DEFINER so it can read the admins table even though the caller
-- cannot; it only ever returns true/false, never the table contents.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.admins a
     where lower(a.email) = lower(
             coalesce(
               nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email',
               ''
             )
           )
  );
$$;

-- The signed-in person's own email, as recorded in their token.
create or replace function public.current_email()
returns text
language sql
stable
as $$
  select lower(
    coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email',
      ''
    )
  );
$$;


-- ──────────────────────────────────────────────── 2. form submissions ──────
-- Field names mirror exactly what the website sends, so nothing is lost or
-- renamed on the way in.

create table if not exists public.seva_signups (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,
  contact     text,
  seva        text,                                  -- e.g. "Food", "Flowers"
  seva_detail text,                                  -- the seva's sub-label
  details     text,                                  -- what they wrote
  lang        text,
  source      text,
  status      text not null default 'new',

  constraint seva_name_len    check (char_length(name) between 1 and 120),
  constraint seva_contact_len check (contact is null or char_length(contact) <= 160),
  constraint seva_details_len check (details is null or char_length(details) <= 4000),
  constraint seva_status_ok   check (status in ('new', 'contacted', 'confirmed', 'declined'))
);

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null,
  email      text,
  subject    text,
  message    text not null,
  lang       text,
  source     text,
  status     text not null default 'new',
  read_at    timestamptz,
  replied_at timestamptz,

  constraint messages_name_len    check (char_length(name) between 1 and 120),
  constraint messages_email_len   check (email is null or char_length(email) <= 200),
  constraint messages_subject_len check (subject is null or char_length(subject) <= 200),
  constraint messages_message_len check (char_length(message) between 1 and 8000),
  constraint messages_status_ok   check (status in ('new', 'read', 'replied', 'archived'))
);


-- ────────────────────────────────────────────────────── 3. editable content ─

create table if not exists public.events (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  title_en       text not null,
  title_kn       text,
  -- Guest names for the programme. The dashboard labels these fields "Guest";
  -- nothing else writes here.
  description_en text,
  description_kn text,
  -- The date, when it is known. Left null the website shows "Date TBA" by
  -- itself, so there is no label for anyone to type or forget.
  starts_at      timestamptz,
  -- Unused. Kept so an older row that set a label still loads.
  date_label_en  text,
  date_label_kn  text,
  location_en    text,
  location_kn    text,
  url            text,
  published      boolean not null default true,
  sort_order     integer not null default 0,

  constraint events_title_len check (char_length(title_en) between 1 and 200)
);

create table if not exists public.photos (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  storage_path text not null,                        -- path inside the photos bucket
  caption_en   text,
  caption_kn   text,
  alt_en       text,                                 -- screen-reader text
  alt_kn       text,
  width        integer,
  height       integer,
  published    boolean not null default true,
  sort_order   integer not null default 0,
  uploaded_by  text,

  constraint photos_path_len check (char_length(storage_path) between 1 and 400)
);

-- Keep updated_at honest on edits.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_touch_updated_at on public.events;
create trigger events_touch_updated_at
  before update on public.events
  for each row execute function public.touch_updated_at();


-- ───────────────────────────────────────────────────────── 4. row security ─
alter table public.admins       enable row level security;
alter table public.seva_signups enable row level security;
alter table public.messages     enable row level security;
alter table public.events       enable row level security;
alter table public.photos       enable row level security;

-- ── admins ────────────────────────────────────────────────────────────────
drop policy if exists admins_select on public.admins;
create policy admins_select on public.admins
  for select to authenticated
  using (public.is_admin() or lower(email) = public.current_email());

drop policy if exists admins_write on public.admins;
create policy admins_write on public.admins
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── the form tables ───────────────────────────────────────────────────────
-- Anyone (including a signed-out visitor) may ADD a submission.
-- Nobody but an admin may read, change or delete one.
do $$
declare t text;
begin
  foreach t in array array['seva_signups', 'messages'] loop
    execute format('drop policy if exists %I on public.%I', t || '_public_insert', t);
    execute format(
      'create policy %I on public.%I for insert to anon, authenticated with check (true)',
      t || '_public_insert', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_admin_read', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_admin())',
      t || '_admin_read', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_admin_update', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())',
      t || '_admin_update', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_admin_delete', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_admin())',
      t || '_admin_delete', t
    );
  end loop;
end $$;

-- ── events & photos ───────────────────────────────────────────────────────
-- Published rows are world-readable (the website needs them); everything
-- else is admin-only.
drop policy if exists events_public_read on public.events;
create policy events_public_read on public.events
  for select to anon, authenticated
  using (published or public.is_admin());

drop policy if exists events_admin_write on public.events;
create policy events_admin_write on public.events
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists photos_public_read on public.photos;
create policy photos_public_read on public.photos
  for select to anon, authenticated
  using (published or public.is_admin());

drop policy if exists photos_admin_write on public.photos;
create policy photos_admin_write on public.photos
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ────────────────────────────────────────────────── 5. photo storage bucket ─
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

drop policy if exists photos_bucket_public_read on storage.objects;
create policy photos_bucket_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'photos');

drop policy if exists photos_bucket_admin_insert on storage.objects;
create policy photos_bucket_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and public.is_admin());

drop policy if exists photos_bucket_admin_update on storage.objects;
create policy photos_bucket_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and public.is_admin());

drop policy if exists photos_bucket_admin_delete on storage.objects;
create policy photos_bucket_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and public.is_admin());


-- ───────────────────────────────────────────────────────────── 6. grants ───
-- Row Level Security decides WHICH rows; these grants decide whether the
-- role may touch the table at all. Without them a request can fail with
-- "permission denied" before any policy is consulted.
grant usage on schema public to anon, authenticated;

grant insert on public.seva_signups, public.messages
  to anon, authenticated;

grant select, insert, update, delete
  on public.seva_signups, public.messages,
     public.events, public.photos, public.admins
  to authenticated;

grant select on public.events, public.photos to anon;

grant execute on function public.is_admin(), public.current_email()
  to anon, authenticated;


-- ────────────────────────────────────────────────────────── 7. handy views ─
-- Small conveniences for the dashboard. security_invoker means the caller's
-- own permissions and RLS apply — these views are NOT a way around the rules.
create or replace view public.inbox_summary
with (security_invoker = true) as
  select
    (select count(*) from public.messages     where status = 'new') as new_messages,
    (select count(*) from public.seva_signups where status = 'new') as new_seva_signups;


-- ══════════════════════════════════════════════════════════════════════════
--  8. ADD YOUR FIRST ADMIN  ← do this, or nobody can open the dashboard
-- ══════════════════════════════════════════════════════════════════════════
--  Replace the address, remove the two leading dashes, and run just this bit.
--  This is the ONLY way in, by design: there is no public sign-up, and the
--  admins table cannot be edited from the website.
--
--  insert into public.admins (email, note)
--  values ('omkarsamithi@gmail.com', 'Samithi admin')
--  on conflict (email) do nothing;
--
-- ══════════════════════════════════════════════════════════════════════════
