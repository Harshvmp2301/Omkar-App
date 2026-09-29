-- ══════════════════════════════════════════════════════════════════════════
--  REMOVE THE DONATIONS TABLE  (only needed if you already ran 0001 before)
-- ══════════════════════════════════════════════════════════════════════════
--
--  WHY
--    Omkar Samithi does not accept donations. The site has no donation form
--    and stores no amounts, so the table has no reason to exist. This removes
--    it, along with anything that referenced it.
--
--  WHEN TO RUN THIS
--    Only if you created the database BEFORE donations were removed — i.e. if
--    your project already has a `donations` table.
--
--    If you are setting up fresh, you do NOT need this file: 0001_init.sql no
--    longer creates the table at all.
--
--  HOW TO CHECK WHICH CASE YOU ARE IN
--    Supabase → Table Editor. If `donations` is listed, run this. If it is
--    not listed, skip this file entirely.
--
--  ⚠️ THIS DELETES THE TABLE AND ANY ROWS IN IT. That is the intent — the
--     Samithi keeps no donation records — but take a CSV export first if you
--     want a copy for your own files.
--
--  Safe to re-run: every statement uses IF EXISTS.
-- ══════════════════════════════════════════════════════════════════════════

-- The summary view reads from `donations`, so it goes first.
drop view if exists public.donation_totals;

-- Policies belong to the table and vanish with it, but dropping them
-- explicitly keeps the intent obvious and is harmless.
drop policy if exists donations_public_insert on public.donations;
drop policy if exists donations_admin_read    on public.donations;
drop policy if exists donations_admin_update  on public.donations;
drop policy if exists donations_admin_delete  on public.donations;

drop table if exists public.donations;

-- Recreate the inbox summary without any donation figures.
create or replace view public.inbox_summary
with (security_invoker = true) as
  select
    (select count(*) from public.messages     where status = 'new') as new_messages,
    (select count(*) from public.seva_signups where status = 'new') as new_seva_signups;
