# Omkar-App

Omkar Samithi is a bilingual (English/Kannada) community platform for the Oman Karnataka Aradhana Samithi, a cultural and spiritual organization based in Muscat, Oman.

## Features

- ✨ **Scroll-driven logo animation** — at `scrollY = 0` the single Omkar logo sits large and exactly centred in a full-screen hero; scrolling shrinks and glides it into its slot in the sticky navbar, completing within the first 15% of the page's scroll (one element, no duplicates)
- 📅 **Upcoming programs** with RSVP, live countdowns, per-event reminders and one-click **Add to Calendar** (.ics) downloads
- 🗓️ **Festival calendar** with countdowns for upcoming Hindu festivals (Navratri, Dussehra, Deepavali …)
- 💝 **Donate** — donation tracker form (purpose picker: General, Seva, Food/Langar, Aarti Supplies, Temple Maintenance) with amount in OMR
- 🙏 **Seva** — volunteer opportunities (Food, Flowers, Oil Lamps, Incense, Temple Bells, Cleaning) with registration form
- ✉️ **Contact** — message form plus the usual emails, feedback form and social links
- 🔔 Browser notifications for event reminders
- 🎥 YouTube video recordings of past programs
- 📝 Blog and festival notes integration
- 🖼️ **Photo gallery** with a keyboard-navigable lightbox
- 🪔 **About the Samithi** — mission pillars and a support/donation call-out
- 🇬🇧🇮🇳 Bilingual support (English/Kannada), persisted between visits
- 📱 Mobile-responsive, dark gold-accented design with accessibility support (focus states, reduced motion)
- 📲 **PWA-ready** — web app manifest + service worker for offline fallback
- 🔗 Contact & social media links
- #️⃣ Hash-based routing (`#/hub`, `#/events`, `#/gallery`, `#/about`) so views are deep-linkable

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
    ├── EventsView.jsx      # RSVP + countdowns + add-to-calendar + festival calendar
    ├── GalleryView.jsx     # gallery grid + lightbox
    ├── AboutView.jsx       # mission, pillars, support CTA
    └── Contact.jsx
public/
├── manifest.webmanifest    # PWA manifest
├── sw.js                   # offline-capable service worker
└── gallery/                # gallery photos
vercel.json                 # Vercel build config (Vite → dist/)
.github/workflows/
└── deploy-vercel.yml       # auto-deploy pipeline (main → prod, branches → preview)
```

## Content updates

All text — including events, videos, blog posts, festival dates and gallery captions — is edited in **`src/data/content.js`** under the `en` and `kn` blocks. Event and festival dates use ISO format (`YYYY-MM-DD`) which powers countdowns and calendar downloads automatically.
