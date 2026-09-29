# 🗄️ supabase/ — the database

Everything the admin dashboard will read lives here. One SQL file creates it
all:

```
supabase/migrations/0001_init.sql   schema, security rules, photo storage
```

---

## Setup — about 10 minutes, once

> **Prefer clicking to reading?** [SETUP-WALKTHROUGH.md](SETUP-WALKTHROUGH.md)
> is the same setup written as a numbered list of buttons, with what you
> should see after each one and a troubleshooting table at the end.
> This page is the reference version.

### 1. Create the project

[supabase.com](https://supabase.com) → **New project**. Pick a region near
Oman (e.g. Frankfurt or Mumbai) and save the database password somewhere safe.

### 2. Create the tables

In the project: **SQL Editor → New query** → paste the **entire** contents of
`migrations/0001_init.sql` → **Run**.

It is written to be **safe to re-run** — every object is created only if it
doesn't exist and every policy is dropped and recreated, so running it twice
gives the same result rather than an error.

You should end up with five tables: `seva_signups`, `messages`, `events`,
`photos`, `admins`.

> There is deliberately **no donations table** — Omkar Samithi does not accept
> donations. If you ran an earlier version of this file and already have one,
> run `migrations/0002_drop_donations.sql` to remove it.

### 3. Add yourself as an admin  ← easy to forget, nothing works without it

Scroll to the bottom of `0001_init.sql` — there's a commented-out `insert`
statement. Replace the address with the Samithi's email, remove the two
leading dashes, and run just that bit:

```sql
insert into public.admins (email, note)
values ('omkarsamithi@gmail.com', 'Samithi admin')
on conflict (email) do nothing;
```

**This is the only way in, by design.** There is no public sign-up, and the
`admins` table cannot be edited from the website — otherwise anyone could
promote themselves. To add a second admin later, run the same statement with
their address.

### 4. Turn on Google sign-in

**Authentication → Providers → Google → Enable.** You'll need an OAuth client
from Google Cloud (the same project as your YouTube key is fine):

1. [console.cloud.google.com](https://console.cloud.google.com) → **APIs &
   Services → Credentials → Create credentials → OAuth client ID**
2. Application type: **Web application**
3. **Authorised redirect URI** — paste this exactly, replacing the project ref:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
4. Copy the **Client ID** and **Client secret** into the Supabase Google
   provider screen and save.

Then, back in Supabase: **Authentication → URL Configuration** → set
**Site URL** to your live site, and add `http://localhost:5173` under
**Redirect URLs** so it works during development too.

> These OAuth values live in the Supabase dashboard, **not** in this repo and
> not in `config/.env.local`. They are only listed there as a reminder of
> where they go.

### 5. Give the app the two values it needs

In `config/.env.local` (see `config/README.md`), from **Settings → API**:

```
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<the anon / publishable key>
VITE_ADMIN_EMAILS=omkarsamithi@gmail.com
```

Restart the dev server. For the live site, add the same names in
**Vercel → Settings → Environment Variables** and redeploy.

> ⛔ **Never use the `service_role` key in this app.** It bypasses every rule
> below, so anyone who viewed the page source would get full access to every
> signup and message. It only ever belongs on a server.

### 6. Open the dashboard

Go to **`/#/admin`** on the site and sign in with the Google account you added
in step 3. You should see four sections: Seva signups, Messages, Events and
Photos.

> If it says the account can't open the dashboard, check the `admins` table —
> the address must match exactly, in lower case. Remember that Row Level
> Security makes a non-admin look like "no data", which is why the dashboard
> says so explicitly rather than showing an empty page.

### 7. Check it worked

Submit a test **Seva** signup on the site. In Supabase,
**Table Editor → seva_signups** should show one row, with the name, seva and
details you typed. If `messages` is empty, that is correct — you have not sent
a contact message yet.

---

## How the security works

The website ships an "anon" key in its JavaScript, so **assume everyone can
read it**. That is fine, because Row Level Security decides what that key is
actually allowed to do:

| Who | seva / messages | events / photos | admins |
|---|---|---|---|
| Anyone (anon key) | **INSERT only** | read published rows | nothing |
| Signed-in admin | read, update, delete | full control | read |
| Not an admin | nothing | read published rows | nothing |

So even with the anon key copied out of your page, the database **refuses to
return** your seva signups or messages. That is the whole reason the public
key is safe to expose.

Two things worth understanding:

- **"No data" often means "not an admin."** Row Level Security returns an
  empty list rather than an error for a signed-in person who isn't on the
  allowlist. If the dashboard looks empty, check the `admins` table first.
- **`is_admin()` is `security definer`.** It reads the allowlist on the
  caller's behalf but only ever returns true/false, never the table contents.

---

## What's deliberately *not* here yet

- **Spam protection on the public forms.** Anyone who can load the site can
  currently insert rows. The schema limits the damage with length and status
  constraints, but rate limiting or a CAPTCHA is a sensible follow-up once
  the dashboard exists.
- **The admin dashboard UI itself.** This migration and the data layer in
  `src/utils/supabase.js` are the foundation; the dashboard screens come next.
- **Event and photo seeding.** The site keeps using the curated content in
  `src/data/content.js` until rows exist here, and falls back to it whenever
  the database is unreachable — the same contract the video and blog feeds use.

---

## ⚠️ Not yet verified against a live project

The SQL has been reviewed and its shape is cross-checked by a test that
compares every field the app sends against the columns in this file
(`src/utils/supabase.test.js`), but **it has never been executed** — this
environment has no PostgreSQL and no network access to Supabase.

Expect to fix small things on the first run. If the SQL Editor reports an
error, send it over: the message names the exact line, and the file is
written so it can simply be re-run after a fix.
