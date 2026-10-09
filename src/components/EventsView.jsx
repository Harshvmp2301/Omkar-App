import { User, MapPin, Bell, BellRing, CalendarPlus } from "lucide-react";
import { dateParts, countdownLabel, formatFullDate, downloadIcs } from "../utils/calendar.js";
import FestivalCalendar from "./FestivalCalendar.jsx";

/**
 * The program list and the festival calendar below it.
 *
 * `events` arrives already merged from App: the Samithi's stored dates laid
 * over the curated list, each at its NEXT occurrence (App asks for
 * `upcomingEvents`). Everything on this page reads that one list — the rows,
 * the times a reminder can be set for, the .ics downloads and the program chips
 * in the calendar — so none of them can contradict another.
 *
 * This view deliberately does not fetch them itself — doing so is what let the
 * calendar show a date the list had already replaced. The rows therefore only
 * ever carry a date the visitor can still act on: a programme that has already
 * happened this year is shown at next year's occurrence, never as upcoming.
 */
export default function EventsView({ t, lang, events, notify, onToggleNotify, flash }) {

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
        <h1 className="section-title display">{t.upcomingPrograms}</h1>
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
      <FestivalCalendar t={t} lang={lang} events={events} flash={flash} />
    </div>
  );
}
