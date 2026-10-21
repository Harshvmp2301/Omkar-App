# Omkar-App

Omkar Samithi is a bilingual (English/Kannada) community platform for the Oman Karnataka Aradhana Samithi, a cultural and spiritual organization based in Muscat, Oman.

## Features

- ✨ **Scroll-driven logo animation (every tab)** — at `scrollY = 0` the single Omkar logo sits large and exactly centred over the full-screen hero while the title, tagline and diya row are anchored to the bottom of the screen (the original first-deployment composition); scrolling shrinks and glides the logo into its slot in the sticky navbar within the first 15% of the page's scroll, and scrolling back up glides it out again — on every tab. Clearance logic lifts the flight only when needed, so the logo never overlaps the hero copy or the content below it (one element, no duplicates)
- 📅 **Upcoming programs** with live countdowns, per-event reminders and a permanent one-click **Add to Calendar** (.ics) button — dimmed until the date is announced. The Samithi sets each program's date once in the dashboard; the site repeats it every year on its own, so nothing needs updating in January
- 🪔 **Diya lamps that follow the year** — each lamp lights 30 days before its own program and, once lit, stays lit until New Year. The row fills up through the year (one lamp, then two, then all three) and goes dark again on 1 January — see `src/utils/diya.js`
- 🗓️ **Festival calendar** — a wall-calendar month grid with every festival and program under its date and today highlighted in gold; click a chip to download the .ics. The festival dates are **worked out from the panchang for whatever year is on screen** (sun and moon, Lahiri ayanamsa, sunrise over Muscat — see `src/utils/panchang.js`), so they move with the moon year after year and nobody maintains a list
- ✉️ **About & Contact** — one merged tab (last in the nav): mission pillars, support call-out, message form and the contact emails. Contact details appear nowhere else
- 🔔 Browser notifications for event reminders
- 🎥 YouTube video recordings of past programs
- 📝 Blog and festival notes integration
- 🖼️ **Photo gallery** — real photos pulled from the Samithi blog posts, with a keyboard-navigable lightbox
- 🇬🇧🇮🇳 Bilingual support (English/Kannada), persisted between visits
- 📱 Mobile-responsive, dark gold-accented design with accessibility support (focus states, reduced motion)
- 📲 **PWA-ready** — web app manifest + service worker for offline fallback
- 🔗 Instagram, Facebook Group, YouTube Channel, the Samithi's Blog and Feedback Form links live in the Pranaams footer on every page
- #️⃣ Hash-based routing (`#/hub`, `#/events`, `#/gallery`, `#/about`) so views are deep-linkable (the retired `#/seva` link falls home)

## Tech

- [Vite](https://vite.dev) + React 19
- [lucide-react](https://lucide.dev) icons
- All bilingual copy and curated content lives in `src/data/content.js` (single source of truth) — the public site renders fully with no backend configured at all
- **Supabase** backend for the live parts: contact messages, admin-dashboard data (events, admins) and the blog-fed gallery table (`gallery_blog_images`)
- **Vercel serverless function** `api/gallery-sync.js` — pulls the photographs from the Samithi's blog into Supabase on a fortnightly cron (see *Gallery sync* below)

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
npm run preview  # serve the production build
```

### 🛠️ Admin dashboard — `#/admin`

Open **`/#/admin`** on the site and sign in with Google. The Samithi's
administrator can then, without touching any code:

- **Messages** — everything sent through the contact form, with unread counts, read/unread and replied markers
- **Events** — a living list: add any event (the three standing programmes and whatever comes next, Dashamotsava included), rename it in both languages, name the guests, set the date AND a time of day that the site prints beside the date everywhere the date appears — and delete any event (confirm-first; it leaves the public site immediately). The saved time of day prints beside the date on every card, in the homepage bar and inside the Add-to-Calendar (.ics) file as a timed entry. Leave the date empty and the site shows "Date TBA" by itself; the venue is always Sri Krishna Temple, Darsait. A stored date repeats every year — the site moves it onto the current year by itself (the `time_text` column carries the time: `alter table public.events add column if not exists time_text text;`)

There is deliberately **no Photos section**: the public gallery is fed from the
Samithi's blog by the gallery-sync function (below), and the dashboard never
uploads photographs.

Access is by allow-list only: there is **no public sign-up**. An address must
be in the `admins` table before it can open the dashboard (see
[`supabase/README.md`](supabase/README.md), step 3, or the click-by-click
[`supabase/SETUP-WALKTHROUGH.md`](supabase/SETUP-WALKTHROUGH.md)).

**The dashboard never slows the public site down.** It is code-split behind a
dynamic import, so the Supabase SDK and all the admin screens are fetched only
when someone opens `#/admin`. A normal visitor's download is unaffected —
`npm run build` shows them as separate chunks.

### 🗄️ Database — where submissions are stored

Seva signups and contact messages are saved to **Supabase**, and that is what
the admin dashboard reads. One SQL file creates everything:

```
supabase/migrations/0001_init.sql   tables, security rules, photo storage
```

Setup (about 10 minutes, once) is in [`supabase/README.md`](supabase/README.md):
create a project, run the SQL, add your email to the `admins` table, enable
Google sign-in, then put the URL and **anon** key in `config/.env.local`.

Row Level Security means the public site can only **add** submissions — the
anon key that ships in the page cannot read seva signups or messages back.
Never put the `service_role` key in this app.

There is deliberately **no donations table**: Omkar Samithi does not accept
donations, and the site has no donation form.

With nothing configured the site works exactly as before and the forms fall
back to email.

### 🖼️ Gallery sync — the blog-fed photographs (`api/gallery-sync.js`)

The public gallery is fed from the Samithi's blog, not from dashboard uploads.
A Vercel serverless function reads `omkarsamithi.blogspot.com`, fetches each
post page, and takes ONLY the post body's own photographs — the blog's header
and sidebar furniture, the profile photo, comment avatars, logo-named files
and the specific graphics the owner named by address never become rows — then
rewrites the `gallery_blog_images` table in Supabase. Rows a run does not
re-see are pruned, so junk deleted anywhere deletes itself here on the next
sync.

- **Schedule:** Vercel cron, fortnightly at 04:00 UTC on the 1st and the 15th
  (`0 4 1,15 * *` in `vercel.json`).
- **Manual run:** the endpoint requires the `CRON_SECRET`, preferably as a
  header — in PowerShell:
  `Invoke-RestMethod -Headers @{Authorization="Bearer YOUR_CRON_SECRET"} https://omkarsamithi.com/api/gallery-sync`.
  A `?secret=` query form exists for a plain browser visit, but it leaves the
  secret in the browser's history — treat it as the emergency door and rotate
  any secret typed that way if in doubt.
- **Never cached:** the function answers `Cache-Control: no-store` on every
  response (401s included), and the service worker bypasses `/api/` URLs
  entirely — a sync response, whose URL may carry the secret, cannot land in
  any cache.
- **Env (Vercel → Settings → Environment Variables):** `CRON_SECRET`,
  `SUPABASE_SERVICE_ROLE_KEY` (server-side only — this key never ships in a
  page) and the site's Supabase URL.

### 🔑 Keys and credentials — all in one place

**Every value lives in a single file: [`config/.env.local`](config/README.md).**
Nothing needs to be hunted for across the code.

```bash
npm run config:init    # creates config/.env.local from the template
```

Then fill in what you have and restart the dev server. See
[`config/README.md`](config/README.md) for where to get each value, and
[`config/apps-script.gs`](config/apps-script.gs) for the form-notification
script. The live site reads the same names from Vercel → Project → Settings
→ Environment Variables.

Blank values are always safe: the site falls back to the curated content.

### Optional: live YouTube uploads

The Content Hub shows a curated video list by default. With
`VITE_YOUTUBE_API_KEY` and `VITE_YOUTUBE_CHANNEL_ID` set, the channel's
newest **3** uploads replace it:

```
VITE_YOUTUBE_API_KEY=…      # YouTube Data API v3 key
VITE_YOUTUBE_CHANNEL_ID=…   # channel id starting with UC
```

No keys, any API error, or quota exhaustion → the curated list stays on
screen; successful responses are cached in `localStorage` for 6 hours.

### Live blog posts — on by default, no key needed

The newest 3 posts stream into the Content Hub's "From the Blog" list from
`omkarsamithi.blogspot.com`, which is built in as the default so this works
with no configuration at all. Blogger's public feed needs **no API key** —
it sends no CORS headers, so it is loaded over JSONP (no proxy, no server).

Override the blog with `VITE_BLOGGER_BLOG_URL` and the count with
`VITE_BLOGGER_MAX`. If the open feed ever stops responding, the app falls
back to Blogger API v3 when `VITE_BLOGGER_API_KEY` (or the YouTube key) is
present. Same contract as YouTube: any failure leaves the curated list in
place, and results are cached for 6 hours.

### Optional: form endpoint

The contact form POSTs JSON to `VITE_FORM_ENDPOINT` when set
(Formspree, Google Apps Script, SheetDB — any CORS JSON webhook), with
success/failure toasts in both languages. Unset (default) or on delivery
failure the forms fall back to the existing `mailto:` flow, so no message
is ever lost. Envelope: `{ form, lang, page, submittedAt, …fields }`.

### Local gallery photos (no hotlinks)

The 8 gallery photos are downloaded from the blog CDN once, converted to
WebP (≤1600 px, q82, EXIF stripped) into `public/gallery/`, and
`src/data/content.js` is rewritten to local paths:

```bash
npm run gallery:download              # download → WebP → rewrite content.js
npm run gallery:download -- --dry-run # show the plan without touching anything
npm run gallery:download -- --force   # re-download and re-convert
```

Needs Node 18+. WebP conversion uses ImageMagick (`magick`/`convert`) or
`cwebp`, whichever is installed (`winget install ImageMagick.ImageMagick`
/ `winget install libwebp` / `apt install webp`). Without a converter the
photos are still saved as `.jpg` — hotlinks go away either way. The same
`public/gallery/` folder carries over unchanged into Next.js.

## Deployment (Vercel)

The app is configured for **auto-deployment to Vercel**. Production is **https://omkarsamithi.com** — the old `omkar-app.vercel.app` address permanently redirects to it (`redirects` in `vercel.json`), so the apex domain is the one canonical host for search engines, link previews, analytics and the PWA.

**How it works** — [`.github/workflows/deploy-vercel.yml`](.github/workflows/deploy-vercel.yml) runs on every push:

| Push target | Deployment |
|---|---|
| `main` | 🟢 **Production** → `omkarsamithi.com` |
| `arena/**` (or any other branch) | 🟡 Preview deployment |
| manual (`workflow_dispatch`) | Runs from the Actions tab |

Build settings live in [`vercel.json`](vercel.json) (framework: Vite → `npm run build` → `dist/`, plus cache-control headers for the service worker and security headers), so Vercel's native Git integration works out of the box too if you prefer connecting the repo in the dashboard instead of using Actions.

**One-time setup** (only needed for the GitHub Actions route):

1. Create an access token at [vercel.com/account/tokens](https://vercel.com/account/tokens)
2. In the GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `VERCEL_TOKEN`, Value: *your token*
3. Push to `main` (or run the workflow manually) — the first run links/creates the `Omkar-App` project automatically.

No tokens are stored in this repository; the workflow reads `VERCEL_TOKEN` from GitHub's encrypted secrets at runtime.

Locally you can also deploy with the Vercel CLI:

```bash
npm run deploy          # production (vercel deploy --prod)
npm run deploy:preview  # preview deployment
```

## Project structure

```
src/
├── App.jsx                 # orchestration: routing, notifications, toasts
├── styles.css              # global stylesheet (design tokens as CSS vars)
├── theme.js                # shared color palette (JS side)
├── data/content.js         # ALL bilingual copy & content
├── hooks/useLocalStorage.js
├── utils/calendar.js       # countdowns, date formatting, .ics generation
└── components/
    ├── Header.jsx          # logo, language toggle, notifications, nav tabs
    ├── Hero.jsx / Diya.jsx
    ├── ContentHub.jsx      # videos, blog, festival notes
    ├── EventsView.jsx      # countdowns + add-to-calendar + festival calendar
    ├── FestivalCalendar.jsx # yellow month-grid festival calendar
    ├── GalleryView.jsx     # gallery grid + lightbox
    ├── AboutView.jsx       # mission, pillars, support CTA
    ├── ContactView.jsx     # contact form (merged into the About tab)
    └── Contact.jsx         # contact emails (About tab only)
public/
├── manifest.webmanifest    # PWA manifest
└── sw.js                   # offline-capable service worker
vercel.json                 # Vercel build config (Vite → dist/)
.github/workflows/
└── deploy-vercel.yml       # auto-deploy pipeline (main → prod, branches → preview)
```

## Content updates

All text — including events, videos, blog posts, festival names and gallery captions — is edited in **`src/data/content.js`** under the `en` and `kn` blocks. Event dates use ISO format (`YYYY-MM-DD`) which powers countdowns and calendar downloads automatically.

Dates are not text, and none of them need a yearly edit:

- **The three programs** repeat every year, so only the day and month of a program date matter: the site moves a stored date onto its occurrence in the current year by itself (`annualOccurrence` in `src/utils/calendar.js`, applied by `rollDates` in `src/utils/events.js`), and the lamps, the program list and the calendar all follow the same value.
- **The festivals** follow the moon and the sun, so they are computed for the year on screen (`src/utils/panchang.js` for the astronomy, `src/utils/festivals.js` for the rule that names each festival's lunar month, tithi and part of the day). The 28 rules are checked against the dates the Samithi already kept for 2026 in `src/utils/festivals.test.js`. If a date ever lands a day off what the temple observes, the fix is one line in that rules table — not a new year's list.
