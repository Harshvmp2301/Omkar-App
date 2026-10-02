# Omkar-App

Omkar Samithi is a bilingual (English/Kannada) community platform for the Oman Karnataka Aradhana Samithi, a cultural and spiritual organization based in Muscat, Oman.

## Features

- ✨ **Scroll-driven logo animation (every tab)** — at `scrollY = 0` the single Omkar logo sits large and exactly centred over the full-screen hero while the title, tagline and diya row are anchored to the bottom of the screen (the original first-deployment composition); scrolling shrinks and glides the logo into its slot in the sticky navbar within the first 15% of the page's scroll, and scrolling back up glides it out again — on every tab. Clearance logic lifts the flight only when needed, so the logo never overlaps the hero copy or the content below it (one element, no duplicates)
- 📅 **Upcoming programs** with live countdowns, per-event reminders and a permanent one-click **Add to Calendar** (.ics) button — dimmed until the date is announced
- 🗓️ **Festival calendar** — a dark-themed wall-calendar month grid (Google-Calendar-style) covering all of 2026, with every announced festival and program listed under its date and today highlighted in gold; click a chip to download the .ics
- 🙏 **Seva** — volunteer opportunities (Food, Flowers, Oil Lamps, Incense, Temple Bells, Cleaning) with a registration form fixed to **Sri Anjaneya Pooja** (yearly program dates shown; no date picker)
- ✉️ **About & Contact** — one merged tab (last in the nav): mission pillars, support call-out, message form and the contact emails. Contact details appear nowhere else
- 🔔 Browser notifications for event reminders
- 🎥 YouTube video recordings of past programs
- 📝 Blog and festival notes integration
- 🖼️ **Photo gallery** — real photos pulled from the Samithi blog posts, with a keyboard-navigable lightbox
- 🇬🇧🇮🇳 Bilingual support (English/Kannada), persisted between visits
- 📱 Mobile-responsive, dark gold-accented design with accessibility support (focus states, reduced motion)
- 📲 **PWA-ready** — web app manifest + service worker for offline fallback
- 🔗 Facebook Group, YouTube Channel and Feedback Form links live in the Pranaams footer on every page
- #️⃣ Hash-based routing (`#/hub`, `#/events`, `#/gallery`, `#/seva`, `#/about`) so views are deep-linkable

## Tech

- [Vite](https://vite.dev) + React 19
- [lucide-react](https://lucide.dev) icons
- No backend required — content lives in `src/data/content.js` (single source of truth for all bilingual text)

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

- **Seva signups** — every registration with contact details, filterable by status (new / contacted / confirmed / declined)
- **Messages** — everything sent through the contact form, with unread counts, read/unread and replied markers
- **Events** — pick one of the three programmes from a list (English and Kannada come as a pair), name the guests, and set the date. Leave the date empty and the site shows "Date TBA" by itself; the venue is always Sri Krishna Temple, Darsait
- **Photos** — upload one or many images at once, then correct the caption on each one (English and Kannada), publish or hide, delete. Uploads appear in the public gallery in front of the photographs that ship with the app; nothing uploaded means nothing changes

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

Seva and Contact POST JSON to `VITE_FORM_ENDPOINT` when set
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

The app is configured for **auto-deployment to Vercel** at `https://omkar-app.vercel.app` (i.e. [Omkar-App.vercel.app](https://Omkar-App.vercel.app)).

**How it works** — [`.github/workflows/deploy-vercel.yml`](.github/workflows/deploy-vercel.yml) runs on every push:

| Push target | Deployment |
|---|---|
| `main` | 🟢 **Production** → `omkar-app.vercel.app` |
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
    ├── SevaView.jsx        # seva cards + registration form
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

All text — including events, videos, blog posts, festival dates and gallery captions — is edited in **`src/data/content.js`** under the `en` and `kn` blocks. Event and festival dates use ISO format (`YYYY-MM-DD`) which powers countdowns and calendar downloads automatically.
