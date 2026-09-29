# Supabase setup — the click-by-click version

Everything below is done **once**. Budget 20–25 minutes, most of it waiting
for a progress bar or hunting for a button. Nothing here costs money; the free
plan is far more than this site needs (500 MB database, 1 GB file storage,
50,000 monthly sign-ins).

Keep this checklist next to you and tick as you go.

    Project ref   ....................................................
    Project URL   ....................................................
    Publishable key (or anon key)
                  ....................................................
    Google Client ID
                  ....................................................
    Google Client secret
                  ....................................................
    Admin email   ....................................................

**Have ready:** the Google account that will administer the site. You will
sign in with it, so use the Samithi's real address — and type it in **lower
case** everywhere. It must be the same address in all four places it appears
(Supabase admin row, Google test user, `VITE_ADMIN_EMAILS`, and your sign-in).

> There is a shorter summary in [README.md](README.md) in this folder. This
> file is the long version, with the buttons named.

---

## Stage 1 · Create the project — 5 minutes

| # | Do this | You should see |
|---|---|---|
| 1 | Go to **supabase.com** → **Start your project** → sign in with GitHub or Google | The dashboard |
| 2 | If asked, create an organisation. Name it `Omkar Samithi`, plan **Free** | Org created |
| 3 | Click **New project** | A form |
| 4 | **Name:** `omkar-samithi` | |
| 5 | **Database Password:** click **Generate a password**, then **copy it somewhere safe** | A long random password |
| 6 | **Region:** **Mumbai (ap-south-1)** — closest to Oman. Frankfurt is a fine second choice | |
| 7 | **Plan:** Free → **Create new project** | A provisioning screen |
| 8 | Wait ~2 minutes, then refresh if it does not move on its own | The project's Table Editor |

> That database password is not needed by the website at all — Supabase keeps
> it. Save it anyway; it is the only way into the database if you ever need it
> directly.

## Stage 2 · Create the tables — 3 minutes

The SQL file creates all five tables, the security rules, and the photo
storage bucket in one go.

| # | Do this | You should see |
|---|---|---|
| 9 | In the left sidebar click **SQL Editor** | An empty query window |
| 10 | Click **+ New query** | A blank editor |
| 11 | Open `supabase/migrations/0001_init.sql` from the project folder. Select **all** of it (Ctrl+A) and copy (Ctrl+C) | |
| 12 | Paste it into the Supabase editor, then click **Run** (or press Ctrl+Enter) | `Success. No rows returned` |
| 13 | Left sidebar → **Table Editor** | Five tables: `admins`, `events`, `messages`, `photos`, `seva_signups` |
| 14 | Left sidebar → **Storage** | A bucket named `photos` |

`Success. No rows returned` is the correct result — creating tables returns no
rows. The file is safe to run twice; if you do, you get the same result, not an
error.

> **If you ran an earlier version of this project** (one that still had a
> donations table), run `supabase/migrations/0002_drop_donations.sql` the same
> way to remove it. On a brand-new project you can ignore that file.

## Stage 3 · Add yourself as an admin — 1 minute

**This is the step everyone forgets.** There is no sign-up: an address must be
in the `admins` table or the dashboard refuses to open. It is deliberate — it
is the only thing standing between your inbox and the public internet.

| # | Do this | You should see |
|---|---|---|
| 15 | SQL Editor → **+ New query** | A blank editor |
| 16 | Paste the statement below, replacing the address with the Samithi's Google address | |
| 17 | Click **Run**, then check **Table Editor → admins** | One row, address in lower case |

```sql
insert into public.admins (email, note)
values ('omkarsamithi@gmail.com', 'Samithi admin')
on conflict (email) do nothing;
```

To add a second admin later, run the same statement with their address.

## Stage 4 · Google sign-in — 10 minutes

Two websites are involved, and the order matters: **Google first**, because
Supabase needs the Client ID, and Google needs the Supabase callback URL — so
keep this page open. Google's console was renamed recently; the buttons below
are the new names.

### 4a · In Google Cloud

| # | Do this | You should see |
|---|---|---|
| 18 | Go to **console.cloud.google.com**, signed in **as the admin account** | Google Cloud home |
| 19 | Top bar → project selector → **New project** → name it `omkar-samithi` → **Create** (if you already have a YouTube project, you may reuse it instead) | Project created |
| 20 | Go to **console.cloud.google.com/auth/overview** — the **Google Auth Platform** | "Google Auth Platform not configured yet" |
| 21 | Click **Get started** and fill it in: **App name** `Omkar Samithi`; **User support email** the admin address; **Audience** = **External**; **Contact email** the admin address; tick the policy box → **Create** | Overview screen |
| 22 | Left menu → **Audience** → under **Test users** click **Add users** → add the admin address → **Save** | The address is listed |
| 23 | Left menu → **Data Access** → this is the page in the screenshot below. On a new project its three tables all say **No rows to display**, and that is exactly what steps **23a–23d** fix | "Your non-sensitive scopes" + three empty tables |
| 24 | Left menu → **Clients** → **Create client** | A form |
| 25 | **Application type:** **Web application**. **Name:** `Omkar Samithi site` | |
| 26 | **Authorized JavaScript origins** → **Add URI** twice: your live site (`https://your-site.vercel.app`) and `http://localhost:5173` | Two rows |
| 27 | **Authorized redirect URIs** → **Add URI** → paste **exactly**, with your own project ref: `https://<project-ref>.supabase.co/auth/v1/callback` | One row |
| 28 | **Create**, then copy the **Client ID** and **Client secret** into the box at the top of this page | A confirmation dialog |

> While the app is in **Testing**, only the test users you listed can sign in,
> and Google may ask them to approve again after about a week. When everything
> works, click **Publish app** on the Audience screen — the scopes above are
> not sensitive, so this needs no Google review.

### Step 23 in full — filling in the empty Data Access page

An empty Data Access page is normal on a fresh project. The three scopes this
app needs are all **non-sensitive**, so adding them costs nothing: no Google
review, no waiting, no explanation to write. Do it now rather than waiting for
a sign-in failure to explain it.

| # | Do this | You should see |
|---|---|---|
| 23a | Click **Add or remove scopes** (top right of the page) | A panel slides in from the right |
| 23b | In the panel's filter box type `userinfo`, then tick **`.../auth/userinfo.email`** and **`.../auth/userinfo.profile`** | Two rows ticked |
| 23c | Find **`openid`** in the same panel and tick it. If it is not listed there, scroll to **Manually add scopes** at the bottom, paste `openid`, and click **Add to table** | Three scopes selected |
| 23d | Click **Update** at the bottom of the panel, then **Save** on the Data Access page — **Save** is greyed out until you do | The three scopes listed under "Your non-sensitive scopes" |

Add nothing else. Any sensitive or restricted scope would put the app into
Google's review queue, and this site never needs one.

> Google's own documentation says the default `email`, `profile`, `openid` set
> is all a plain sign-in needs, so an empty page here is not necessarily fatal
> — but it is what Supabase documents as required, and an undeclared scope is
> the kind of thing that shows up later as a refused sign-in, or as a session
> with no email address, which the allowlist in Stage 3 cannot match.

### 4b · Back in Supabase

| # | Do this | You should see |
|---|---|---|
| 29 | Left sidebar → **Authentication** → **Sign In / Providers** | A list of providers |
| 30 | Click **Google**, switch **Enable** on, paste the **Client ID** and **Client secret** | The fields fill |
| 31 | **Save** | "Success" toast |
| 32 | Left sidebar → **Authentication** → **URL Configuration** | Site URL + Redirect URLs |
| 33 | **Site URL:** your live site, e.g. `https://your-site.vercel.app` | |
| 34 | **Redirect URLs** → add these two, replacing the domain with your real one: | Two rows |

```
http://localhost:5173/**
https://your-site.vercel.app/**
```

The `/**` is a wildcard that also allows the `#/admin` and `?admin=1` parts of
the address. Without it, sign-in bounces back to the home page with no session
and no explanation — this is the single most common cause of a sign-in that
"does nothing".

## Stage 5 · Give the app three values — 2 minutes

| # | Do this | You should see |
|---|---|---|
| 35 | In Supabase: **Project Settings** → **API Keys** (or click the **Connect** button in the top bar) | Keys are listed |
| 36 | Copy the **Project URL** and the **publishable key** — it starts with `sb_publishable_`. If your project only shows the older **anon** key (a long one starting with `eyJ`), copy that; both work | |
| 37 | Open `config/.env.local` in the project (if the file is missing, run `npm run config:init`) and fill in the three lines | |
| 38 | Restart the dev server: stop it, then `npm run dev` | It starts normally |

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<the publishable key, or the older anon key>
VITE_ADMIN_EMAILS=omkarsamithi@gmail.com
```

The variable keeps the old "ANON" name even if you paste the new publishable
key — they are the same job, and both are safe to expose in a web page.

**For the live site**, add the same three names in **Vercel → your project →
Settings → Environment Variables**, then redeploy. `config/.env.local` only
affects the copy running on your own machine.

> ⛔ **Never use the key labelled `sb_secret_…` / `service_role`.** It ignores
> every security rule and would expose every signup and message to anyone who
> views the page source. It is the one key that must never reach this app.

## Stage 6 · First sign-in — 2 minutes

| # | Do this | You should see |
|---|---|---|
| 39 | Open your site and add `?admin=1` to the end of the address, e.g. `http://localhost:5173/?admin=1` (or `#/admin`) | A sign-in card |
| 40 | Click **Sign in with Google** and choose the admin account | You land back on the dashboard, four tabs |
| 41 | Submit a test **Seva** signup on the public site, then open **Seva signups** in the dashboard | Your test entry is listed |

If the dashboard says the account cannot open it, the `admins` row and the
Google address differ — check spelling and lower case.

---

## If something goes wrong

| What you see | What it means | Fix |
|---|---|---|
| "Supabase is not configured" card | The app cannot see the two values | Check `config/.env.local`, then **restart the dev server** — Vite reads env files only at startup |
| Sign-in returns to the home page, no dashboard | The return URL is not on the allowlist | Authentication → URL Configuration → add `https://your-site/**` (and `http://localhost:5173/**`) |
| "Access blocked: this app's request is invalid" | Wrong redirect URI in Google | The URI in Google must be exactly `https://<project-ref>.supabase.co/auth/v1/callback` |
| "This account can't open the dashboard" | Signed in fine, but not on the allowlist | Stage 3 — and check the address is lower case and matches exactly |
| Google says the app is not verified | The app is in Testing | Add the address under Audience → Test users, or Publish app |
| Google refuses the request with a scope error | Data Access is still empty | Stage 4a, step 23a–23d — declare the three basic scopes |
| SQL Editor shows an error | Usually a partial paste | Copy the whole file again; the script is safe to re-run. Send me the exact message and line number |
| Photos will not upload | Wrong key in use, or the bucket is missing | Confirm the key is the publishable/anon one, and that Storage shows a `photos` bucket (Stage 2) |

## Two things worth knowing

**"No data" often means "not an admin."** Row Level Security returns an empty
list rather than an error for someone who is signed in but not allow-listed.
That is why the dashboard says so explicitly instead of showing a blank page.

**A free project can be paused** after about a week with no activity. If the
site ever says it cannot reach the database, open the Supabase dashboard and
look for **Restore**, then reload.

---

*Written 29 Sep 2026, against the Supabase dashboard as it looks today, with
the Google console already renamed to "Google Auth Platform". If a button has
moved since, tell me what you see on screen and I will correct this page.*
