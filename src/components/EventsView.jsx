import { useEffect, useState } from "react";
import { User, MapPin, Bell, BellRing, CalendarPlus } from "lucide-react";
import { dateParts, countdownLabel, formatFullDate, downloadIcs } from "../utils/calendar.js";
import { loadEvents } from "../utils/events.js";
import FestivalCalendar from "./FestivalCalendar.jsx";

export default function EventsView({ t, lang, notify, onToggleNotify, flash }) {
  // Whatever the Samithi maintains in the dashboard is laid over the curated
  // list — programme by programme, so setting one date never removes the other
  // two. With nothing stored, or if the database is unreachable, this is the
  // curated list untouched, the same contract the video and blog feeds use.
  // The result remembers WHICH language it was built for, so switching
  // language re-derives rather than showing the wrong one.
  const [live, setLive] = useState({ lang: null, events: null });

  useEffect(() => {
    let alive = true;
    loadEvents(t.eventsList, lang).then((events) => {
      if (alive) setLive({ lang, events });
    });
    return () => {
      alive = false;
    };
  }, [lang, t]);

  const events = live.lang === lang && live.events ? live.events : t.eventsList;

  const handleIcs = (e) => {
    const ok = downloadIcs({
      title: e.title,
      dateISO: e.date,
      venue: e.venue,
      description: `${t.appName}${e.guest ? ` — ${e.guest}` : ""}`,
    });
    flash(ok ? t.icsDownloaded : t.tbaDate);
  };

  return (
    <div className="section section--narrow">
      <div className="section-head reveal">
        <h2 className="section-title display">{t.upcomingPrograms}</h2>
        <span className="note">{t.sampleDates}</span>
      </div>

      <div className="event-list">
        {events.map((e) => {
          const parts = e.date ? dateParts(e.date, lang) : { day: e.day, mon: e.mon };
          const countdown = countdownLabel(e.date, t);
          return (
            <div key={e.id} className="event-row">
              <div className="event-date">
                <span className="event-day display">{parts.day}</span>
                <span className="event-mon">{parts.mon}</span>
              </div>
              <div className="event-info">
                <p className="event-title display">{e.title}</p>
                <div className="event-sub">
                  {e.guest && (
                    <span>
                      <User size={12} aria-hidden="true" /> {e.guest}
                    </span>
                  )}
                  <span>
                    <MapPin size={12} aria-hidden="true" /> {e.venue}
                  </span>
                  {countdown ? (
                    <span className="countdown-chip" title={e.date ? formatFullDate(e.date, lang) : undefined}>
                      ⏳ {countdown}
                    </span>
                  ) : (
                    !e.date && <span className="countdown-chip muted-chip">{t.tbaDate}</span>
                  )}
                </div>
              </div>
              <div className="event-actions">
                <button
                  type="button"
                  className="bell-btn"
                  onClick={() => onToggleNotify(e.id, e.title)}
                  title={notify[e.id] ? t.remindersOn : t.remindersOff}
                  aria-label={notify[e.id] ? t.remindersOn : t.remindersOff}
                  aria-pressed={!!notify[e.id]}
                >
                  {notify[e.id] ? (
                    <BellRing size={18} color="var(--gold-bright)" aria-hidden="true" />
                  ) : (
                    <Bell size={18} color="var(--muted)" aria-hidden="true" />
                  )}
                </button>
                {/* Add-to-Calendar is always present; dimmed until the date is known */}
                <button
                  type="button"
                  className={`ics-btn ${e.date ? "" : "dimmed"}`}
                  onClick={() => handleIcs(e)}
                  title={e.date ? t.addToCalendar : t.tbaDate}
                  aria-label={`${t.addToCalendar}: ${e.title}`}
                >
                  <CalendarPlus size={15} aria-hidden="true" />
                  <span className="ics-label">{t.addToCalendar}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full month-grid festival calendar (yellow wall-calendar style) */}
      <div className="section-head section-head--gap reveal">
        <h2 className="section-title display">{t.festivalCalendar}</h2>
        <span className="note">{t.festivalNote}</span>
      </div>
      <FestivalCalendar t={t} lang={lang} flash={flash} />
    </div>
  );
}
