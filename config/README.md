# 🔑 config/ — everything you need to fill in

This folder is the **only** place you put keys and credentials. You should
never need to open a code file to add one.

| File | What it is | Committed to git? |
|---|---|---|
| **`.env.local`** | **← the file you fill in.** Your real keys live here. | ❌ No — private, git-ignored |
| `.env.example` | The blank template `.env.local` is made from. | ✅ Yes |
| `README.md` | This guide. | ✅ Yes |
| `apps-script.gs` | Optional: emails you each form submission and logs it to a spreadsheet. | ✅ Yes |

If `config/.env.local` is ever missing — a fresh clone, or the sandbox was
reset — just run:

```bash
npm run config:init
```

That copies the template back. It never overwrites a file you already filled in.

---

## The values, one by one

### 1. YouTube — already built and working

Shows the newest **3** uploads on the Content Hub, replacing the hand-written
list. Automatically falls back to that list if YouTube is ever unreachable.

| Variable | Where to get it |
|---|---|
| `VITE_YOUTUBE_API_KEY` | [console.cloud.google.com](https://console.cloud.google.com) → create a project → **APIs & Services → Library** → search **YouTube Data API v3** → **Enable** → **Credentials → Create credentials → API key** |
| `VITE_YOUTUBE_CHANNEL_ID` | YouTube → your channel → **Settings → Advanced settings → Channel ID**. Starts with `UC`, about 24 characters. |

> 🔒 **Do the restriction, it takes 30 seconds.** The key is visible to anyone
> who views the site's source, so after creating it click **Restrict key →
> Application restrictions → Websites** and add your live domain plus
> `http://localhost:5173`. Without it, a stranger can copy the key and burn
> through your daily quota, and the video feed will appear to stop working.

### 2. Blogger — already built, and **no key needed**

**Nothing to do here.** Blogger's public feed is open — no signup, no key, no
Google Cloud setup. It was verified working live on 29 September 2026, pulling
real posts from the Samithi blog.

`omkarsamithi.blogspot.com` is now **built into the app as the default**, so
the feed works even if this credentials file is missing entirely. The two
variables below only exist if you ever want to point it at a different blog.

| Variable | Value |
|---|---|
| `VITE_BLOGGER_BLOG_URL` | `omkarsamithi.blogspot.com` — the default, already filled in |
| `VITE_BLOGGER_MAX` | `3` — already filled in |
| `VITE_BLOGGER_API_KEY` | **leave blank.** Optional insurance only (see below) |

Omkar Samithi is the blog still being updated, so it drives the live feed. The
older **Omkar Sandesh** posts already in the site are left untouched and keep
showing whenever the feed can't be reached.

**Optional insurance:** if the open feed ever stops responding, the app
automatically falls back to **Blogger API v3** — but only if a key is present.
To arm that fallback, reuse your YouTube key: enable *Blogger API v3* in the
same Google Cloud project and set `VITE_BLOGGER_API_KEY` (or just leave it
blank and the YouTube key is picked up). You do not need to do this today.

### 3. Forms → email + a copy you can read later

Fills in `VITE_FORM_ENDPOINT` and you get **both** things you asked for:
an email to the admin *and* a running record of every submission.

Setup, about five minutes:

1. Go to [script.google.com](https://script.google.com) → **New project**.
2. Delete the sample code and paste the whole of `config/apps-script.gs`.
3. Change `ADMIN_EMAIL` at the top to the Samithi's email address.
4. **Deploy → New deployment → Web app.**
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**
5. Click **Deploy**, allow the permissions it asks for, and copy the **Web app URL**.
6. Paste that URL into `config/.env.local` as `VITE_FORM_ENDPOINT`, then restart the dev server.

A spreadsheet is created automatically the first time someone submits the
form; its link arrives in the first notification email. Until the Supabase
admin dashboard is built, that spreadsheet *is* your dashboard for messages.

### 4. Supabase — where seva signups and messages are stored

**The forms already save here.** Fill these in and every seva signup and
message starts landing in the database, ready for the admin dashboard to read.

**First, create the database itself** — about 10 minutes, once. The full
step-by-step is in [`supabase/README.md`](../supabase/README.md); the short
version: create a Supabase project, run
`supabase/migrations/0001_init.sql` in its SQL Editor, add your email to the
`admins` table, and turn on Google sign-in.

Then [supabase.com](https://supabase.com) → your project → **Settings → API**:

| Variable | What to paste |
|---|---|
| `VITE_SUPABASE_URL` | **Project URL** |
| `VITE_SUPABASE_ANON_KEY` | The **anon / publishable** key |
| `VITE_ADMIN_EMAILS` | The Gmail addresses allowed into the dashboard, comma-separated |

> ⛔ **Never paste the `service_role` key into this folder, this app, or any
> chat.** It bypasses every security rule, so anyone who viewed the page
> source would get full access to every signup and message. If a job ever
> needs it, it belongs on a server — ask me and I'll set that up properly.

**Without these values nothing breaks.** The forms skip the database and use
their existing email fallback instead — but nothing is stored, so the
dashboard would have nothing to show.

### 5. Google sign-in for the admin dashboard

These are **not** used by this app — Google sign-in is configured inside the
Supabase dashboard. They're listed at the bottom of `.env.example`, commented
out, only so every credential lives in one place.

---

## Adding these to the live site

`config/.env.local` only affects the app **on this machine**. The live site on
Vercel reads its values from:

**Vercel → your project → Settings → Environment Variables**

Add the same names with the same values there, then **redeploy** — environment
changes only take effect on a new deployment.

---

## Quick health check

After filling things in, run:

```bash
npm run dev
```

Then look at the browser console:

| What you see | What it means |
|---|---|
| No errors, newest videos/posts appear | ✅ Working |
| `youtube http 403` | The API key is wrong, the quota is spent, or the restriction doesn't include this address |
| The curated videos/posts still show | The feed couldn't be reached — **this is the designed fallback**, not a crash. Check the key, then reload |
| Nothing changes at all | The dev server wasn't restarted after editing `.env.local` |
| A form shows "couldn't send" but the email arrives | The webhook worked and the database didn't — check the Supabase values above |
