-- ══════════════════════════════════════════════════════════════════════════
--  0003 — the blog photograph stream (round 54)
--
--  The gallery stopped depending on hand uploads: a Vercel cron function
--  (/api/gallery-sync, 1st and 15th of each month, plus a manual trigger)
--  reads every post of the Samithi's Blogger blogs and stores EVERY image
--  it finds here. The public site only ever READS this table; the writes
--  arrive with the service role key, which bypasses RLS by design, so no
--  write policy exists on purpose — anon and signed-in visitors can look,
--  never touch.
--
--  Safe to re-run: every statement is create-if-not-exists / drop-and-
--  recreate, matching 0001's behaviour.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.gallery_blog_images (
  -- the full-size image URL, exactly as Blogger serves it; the identity
  url          text primary key,
  -- the same picture at tile size, so a phone never downloads 1600px
  thumb_url    text not null,
  blog_host    text not null,
  post_title   text not null default '',
  post_url     text not null default '',
  published_at timestamptz not null default now(),
  -- position inside the post, so a post's pictures keep their order
  pos          integer not null default 0,
  -- which sync run last saw this image; a run deletes the rows of its
  -- blog that it did NOT see again, using this stamp
  synced_at    timestamptz not null default now()
);

create index if not exists gallery_blog_images_order
  on public.gallery_blog_images (published_at desc, pos asc);

create index if not exists gallery_blog_images_host
  on public.gallery_blog_images (blog_host);

alter table public.gallery_blog_images enable row level security;

drop policy if exists gallery_blog_images_read on public.gallery_blog_images;
create policy gallery_blog_images_read on public.gallery_blog_images
  for select to anon, authenticated
  using (true);

-- No insert/update/delete policy: the sync function writes with the
-- service role key, and nothing else in the world may write here.
