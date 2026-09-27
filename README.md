# Omkar-App

Omkar Samithi is a bilingual (English/Kannada) community platform for the Oman Karnataka Aradhana Samithi, a cultural and spiritual organization based in Muscat, Oman.

## Features

- 📅 **Upcoming programs** with RSVP, live countdowns, per-event reminders and one-click **Add to Calendar** (.ics) downloads
- 🗓️ **Festival calendar** with countdowns for upcoming Hindu festivals (Navratri, Dussehra, Deepavali …)
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
```

## Content updates

All text — including events, videos, blog posts, festival dates and gallery captions — is edited in **`src/data/content.js`** under the `en` and `kn` blocks. Event and festival dates use ISO format (`YYYY-MM-DD`) which powers countdowns and calendar downloads automatically.
